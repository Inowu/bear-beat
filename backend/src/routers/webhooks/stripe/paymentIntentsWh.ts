import { Request } from 'express';
import { Stripe } from 'stripe';
import { PrismaClient } from '@prisma/client';
import { StripeEvents } from './events';
import { log } from '../../../server';
import { prisma } from '../../../db';
import { addGBToAccount } from '../../products/services/addGBToAccount';
import { OrderStatus } from '../../subscriptions/interfaces/order-status.interface';
import { getStripeWebhookBody } from '../../utils/verifyStripeSignature';
import { subscribe } from '../../subscriptions/services/subscribe';
import { PaymentService } from '../../subscriptions/services/types';
import { addDays } from 'date-fns';
import { sendPlanActivatedEmail } from '../../../email';
import { manyChat } from '../../../many-chat';
import stripeInstance from '../../../stripe';
import stripeOxxoInstance, { isStripeOxxoConfigured } from '../../../stripe/oxxo';
import { ingestAnalyticsEvents } from '../../../analytics';
import { ingestPaymentSuccessEvent } from '../../../analytics/paymentSuccess';

const toPositiveInt = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
};

const toNullableString = (
  value: unknown,
  maxLength = 120,
): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized) return null;
  return normalized.slice(0, maxLength);
};

const resolveStripePaymentFailureContext = (
  paymentIntent: Stripe.PaymentIntent,
): {
  reason: string;
  declineCode: string | null;
  stripeErrorType: string | null;
  stripeErrorCode: string | null;
  nextActionType: string | null;
  requires3ds: boolean;
  networkName: string | null;
} => {
  const lastError = paymentIntent.last_payment_error as
    | Stripe.PaymentIntent.LastPaymentError
    | null
    | undefined;
  const declineCode = toNullableString((lastError as any)?.decline_code, 80);
  const stripeErrorType = toNullableString(lastError?.type, 80);
  const stripeErrorCode = toNullableString(lastError?.code, 80);
  const nextActionType = toNullableString((paymentIntent as any)?.next_action?.type, 80);
  const networkName =
    toNullableString((lastError as any)?.payment_method?.card?.network, 40)
    ?? toNullableString(
      (paymentIntent as any)?.charges?.data?.[0]?.payment_method_details?.card?.network,
      40,
    );

  const requires3ds = Boolean(
    nextActionType === 'use_stripe_sdk'
      || stripeErrorCode === 'authentication_required'
      || stripeErrorCode === 'payment_intent_authentication_failure'
      || declineCode === 'authentication_required',
  );

  const isNetworkFailure = Boolean(
    stripeErrorType === 'api_connection_error'
      || stripeErrorCode === 'processing_error',
  );

  const reason = declineCode
    ? `decline_${declineCode}`
    : requires3ds
      ? '3ds_authentication_required'
      : isNetworkFailure
        ? 'network_error'
        : stripeErrorType
          ? `stripe_${stripeErrorType}`
          : stripeErrorCode
            ? `stripe_code_${stripeErrorCode}`
            : 'payment_intent_failed';

  return {
    reason,
    declineCode,
    stripeErrorType,
    stripeErrorCode,
    nextActionType,
    requires3ds,
    networkName,
  };
};

const toCurrencyUpper = (value: unknown): string | null =>
  typeof value === 'string' && value.trim()
    ? value.trim().toUpperCase()
    : null;

const amountFromMinorUnits = (value: unknown): number | null => {
  const raw = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(raw)) return null;
  return Math.round((raw / 100) * 100) / 100;
};

const resolveStripeCustomerIdFromObject = (object: any): string | null => {
  const customer = object?.customer;
  if (typeof customer === 'string' && customer.trim()) return customer.trim();
  if (customer && typeof customer.id === 'string' && customer.id.trim()) {
    return customer.id.trim();
  }
  return null;
};

const resolvePaymentFailureReasonForInvoice = (params: {
  invoice: Stripe.Invoice;
  failureContext: ReturnType<typeof resolveStripePaymentFailureContext> | null;
}): string => {
  const { invoice, failureContext } = params;
  if (failureContext) return 'billing_subscription_payment_failed';
  const billingReason = toNullableString((invoice as any)?.billing_reason, 80);
  if (billingReason === 'subscription_cycle' || billingReason === 'subscription_create') {
    return 'billing_subscription_payment_failed';
  }
  if (billingReason === 'manual') return 'past_due';
  return 'billing_subscription_payment_failed';
};

const resolvePlanOrderFromInvoiceContext = async (params: {
  explicitOrderId: number | null;
  invoiceId: string | null;
  paymentIntentId: string | null;
  subscriptionId: string | null;
  userId: number | null;
}) => {
  const {
    explicitOrderId,
    invoiceId,
    paymentIntentId,
    subscriptionId,
    userId,
  } = params;

  if (explicitOrderId) {
    const byId = await prisma.orders.findFirst({
      where: { id: explicitOrderId },
      orderBy: { id: 'desc' },
    });
    if (byId) return byId;
  }

  if (invoiceId) {
    const byInvoice = await prisma.orders.findFirst({
      where: { invoice_id: invoiceId },
      orderBy: { id: 'desc' },
    });
    if (byInvoice) return byInvoice;
  }

  if (paymentIntentId) {
    const byPi = await prisma.orders.findFirst({
      where: { invoice_id: paymentIntentId },
      orderBy: { id: 'desc' },
    });
    if (byPi) return byPi;
  }

  if (subscriptionId) {
    const bySubscription = await prisma.orders.findFirst({
      where: {
        txn_id: subscriptionId,
        ...(userId ? { user_id: userId } : {}),
      },
      orderBy: [{ date_order: 'desc' }, { id: 'desc' }],
    });
    if (bySubscription) return bySubscription;
  }

  return null;
};

export const stripeInvoiceWebhook = async (req: Request) => {
  const payloadStr = getStripeWebhookBody(req);
  const payload: Stripe.Event = JSON.parse(payloadStr);
  await processStripePaymentWebhookPayload(payload);
};

export const processStripePaymentWebhookPayload = async (
  payload: Stripe.Event,
) => {

  if (!shouldHandleEvent(payload)) return;

  if (
    payload.type === StripeEvents.INVOICE_PAYMENT_FAILED
    || payload.type === StripeEvents.INVOICE_PAID
  ) {
    await handleInvoiceEvent(payload);
    return;
  }

  if (payload.type === StripeEvents.CHECKOUT_SESSION_COMPLETED) {
    await handleCheckoutSessionCompletedEvent(payload);
    return;
  }

  const rawPi = payload.data.object as Stripe.PaymentIntent;
  const paymentIntentId = typeof (rawPi as any)?.id === 'string' ? String((rawPi as any).id) : '';

  // Stripe "payload style: summary" can omit metadata. We can still resolve by:
  // - fetching the PaymentIntent from Stripe, OR
  // - looking up our DB order by txn_id/invoice_id (pi id).
  const resolvedPi = await resolvePaymentIntent(rawPi);

  let productOrderId =
    toPositiveInt((resolvedPi as any)?.metadata?.productOrderId)
    ?? toPositiveInt((rawPi as any)?.metadata?.productOrderId);
  let planOrderId =
    toPositiveInt((resolvedPi as any)?.metadata?.orderId)
    ?? toPositiveInt((rawPi as any)?.metadata?.orderId);
  const metaUserId =
    toPositiveInt((resolvedPi as any)?.metadata?.userId)
    ?? toPositiveInt((rawPi as any)?.metadata?.userId);

  const [linkedProductOrder, linkedPlanOrder] = await Promise.all([
    paymentIntentId && !productOrderId
      ? prisma.product_orders.findFirst({
          where: { txn_id: paymentIntentId },
          orderBy: { id: 'desc' },
        })
      : Promise.resolve(null),
    paymentIntentId && !planOrderId
      ? prisma.orders.findFirst({
          where: { invoice_id: paymentIntentId },
          orderBy: { id: 'desc' },
        })
      : Promise.resolve(null),
  ]);

  if (!productOrderId && linkedProductOrder) {
    productOrderId = linkedProductOrder.id;
  }
  if (!planOrderId && linkedPlanOrder) {
    planOrderId = linkedPlanOrder.id;
  }

  const user =
    (metaUserId
      ? await prisma.users.findFirst({ where: { id: metaUserId } })
      : null)
    ?? (linkedProductOrder?.user_id
      ? await prisma.users.findFirst({ where: { id: linkedProductOrder.user_id } })
      : null)
    ?? (linkedPlanOrder?.user_id
      ? await prisma.users.findFirst({ where: { id: linkedPlanOrder.user_id } })
      : null)
    ?? (await getUserFromPayload(prisma, payload, metaUserId));

  if (!user) {
    log.error('[STRIPE_WH] User not found in event', {
      eventType: payload.type,
      eventId: payload.id,
    });
    return;
  }

  switch (payload.type) {
    case StripeEvents.PAYMENT_INTENT_FAILED: {
      log.info('[STRIPE_WH] Payment intent failed', {
        eventId: payload.id,
      });
      const failureContext = resolveStripePaymentFailureContext(resolvedPi);
      const paymentCurrency =
        typeof resolvedPi.currency === 'string'
          ? resolvedPi.currency.toUpperCase()
          : null;
      const paymentAmount =
        typeof resolvedPi.amount === 'number' && Number.isFinite(resolvedPi.amount)
          ? Math.round((resolvedPi.amount / 100) * 100) / 100
          : null;

      const trackPaymentFailed = async (orderId: number | null, orderType: 'plan' | 'product' | 'unknown') => {
        try {
          await ingestAnalyticsEvents({
            prisma,
            events: [
              {
                eventId: `stripe:${payload.id}:payment_failed`.slice(0, 80),
                eventName: 'payment_failed',
                eventCategory: 'purchase',
                eventTs: new Date().toISOString(),
                userId: user.id,
                currency: paymentCurrency,
                amount: paymentAmount,
                metadata: {
                  provider: 'stripe',
                  reason: failureContext.reason,
                  orderId,
                  orderType,
                  stripePaymentIntentId: resolvedPi.id,
                  decline_code: failureContext.declineCode,
                  stripe_error_type: failureContext.stripeErrorType,
                  stripe_error_code: failureContext.stripeErrorCode,
                  stripe_next_action_type: failureContext.nextActionType,
                  requires_3ds: failureContext.requires3ds,
                  network: failureContext.networkName,
                },
              },
            ],
            sessionUserId: user.id,
          });
        } catch (e) {
          log.debug('[STRIPE_WH] analytics payment_failed skipped (payment_intent)', {
            error: e instanceof Error ? e.message : e,
          });
        }
      };

      if (productOrderId) {
        const order = await prisma.product_orders.findFirst({
          where: { id: productOrderId },
        });

        if (!order) {
          log.warn('[STRIPE_WH] Product order not found for payment intent', {
            eventId: payload.id,
          });
          return;
        }

        await prisma.product_orders.update({
          where: { id: order.id },
          data: { status: OrderStatus.FAILED },
        });
        await trackPaymentFailed(order.id, 'product');
        return;
      }

      if (planOrderId) {
        const order = await prisma.orders.findFirst({
          where: { id: planOrderId },
        });

        if (!order) {
          log.warn('[STRIPE_WH] Plan order not found for payment intent', {
            eventId: payload.id,
          });
          return;
        }

        await prisma.orders.update({
          where: { id: order.id },
          data: { status: OrderStatus.FAILED },
        });

        try {
          await manyChat.addTagToUser(user, 'FAILED_PAYMENT');
        } catch (e) {
          log.error('[STRIPE_WH] Error adding FAILED_PAYMENT tag', {
            error: e instanceof Error ? e.message : e,
          });
        }
        await trackPaymentFailed(order.id, 'plan');
        return;
      }

      await trackPaymentFailed(null, 'unknown');
      log.warn(
        '[STRIPE_WH] Payment intent without resolvable order id; no action taken',
        { eventId: payload.id },
      );
      break;
    }
    case StripeEvents.PAYMENT_INTENT_SUCCEEDED: {
      log.info('[STRIPE_WH] Payment intent succeeded', {
        eventId: payload.id,
      });

      if (productOrderId) {
        await addGBToAccount({
          user,
          prisma,
          orderId: productOrderId,
        });
        return;
      }

      if (planOrderId) {
        const order = await prisma.orders.findFirst({
          where: { id: planOrderId },
        });

        if (!order) {
          log.warn('[STRIPE_WH] Plan order not found for payment intent', {
            eventId: payload.id,
          });
          return;
        }

        if (order.status === OrderStatus.PAID) {
          log.info('[STRIPE_WH] Plan order already paid; skipping', {
            eventId: payload.id,
          });
          return;
        }

        const plan = order.plan_id
          ? await prisma.plans.findFirst({ where: { id: order.plan_id } })
          : null;

        if (!plan) {
          log.warn('[STRIPE_WH] Plan not found for order', { eventId: payload.id });
          return;
        }

        // Grant access (one-time OXXO payment): extend from "now" (payment confirmation time).
        await subscribe({
          prisma,
          user,
          orderId: order.id,
          subId: resolvedPi.id,
          service: order.payment_method === PaymentService.STRIPE_OXXO ? PaymentService.STRIPE_OXXO : PaymentService.STRIPE,
          expirationDate: addDays(new Date(), Number(plan.duration) || 30),
        });

        try {
          await manyChat.addTagToUser(user, 'SUCCESSFUL_PAYMENT');
        } catch (e) {
          log.error('[STRIPE_WH] Error while adding ManyChat tag', {
            error: e instanceof Error ? e.message : e,
          });
        }

        try {
          await sendPlanActivatedEmail({
            userId: user.id,
            toEmail: user.email,
            toName: user.username,
            planName: plan.name,
            price: plan.price,
            currency: plan.moneda.toUpperCase(),
            orderId: order.id,
          });
        } catch (e) {
          log.error('[STRIPE_WH] Plan activated email failed (non-blocking)', {
            errorType: e instanceof Error ? e.name : typeof e,
          });
        }

        try {
          await ingestPaymentSuccessEvent({
            prisma,
            provider:
              order.payment_method === PaymentService.STRIPE_OXXO
                ? 'stripe_oxxo'
                : 'stripe',
            providerEventId: payload.id,
            userId: user.id,
            orderId: order.id,
            planId: order.plan_id ?? null,
            amount: Number(order.total_price) || 0,
            currency: plan.moneda?.toUpperCase?.() ?? null,
            isRenewal: false,
            eventTs: new Date(),
            metadata: {
              stripePaymentIntentId: resolvedPi.id,
            },
          });
        } catch (e) {
          log.debug('[STRIPE_WH] analytics payment_success skipped (payment_intent)', {
            error: e instanceof Error ? e.message : e,
          });
        }

        return;
      }

      log.info(
        '[STRIPE_WH] Payment intent without resolvable order id; no action taken',
        { eventId: payload.id },
      );
      break;
    }
    default: {
      log.info('[STRIPE_WH] Unhandled event', { eventType: payload.type, eventId: payload.id });
    }
  }
};

const handleInvoiceEvent = async (payload: Stripe.Event): Promise<void> => {
  const rawInvoice = payload.data.object as Stripe.Invoice;
  const invoice = await resolveInvoice(rawInvoice);
  const paymentIntent = await resolveInvoicePaymentIntent(invoice);

  const invoiceId =
    toNullableString((invoice as any)?.id, 120)
    ?? toNullableString((rawInvoice as any)?.id, 120);
  const paymentIntentId =
    toNullableString(paymentIntent?.id, 120)
    ?? toNullableString((invoice as any)?.payment_intent, 120)
    ?? toNullableString((rawInvoice as any)?.payment_intent, 120);
  const subscriptionId =
    toNullableString(
      typeof (invoice as any)?.subscription === 'string'
        ? (invoice as any)?.subscription
        : (invoice as any)?.subscription?.id,
      120,
    )
    ?? toNullableString(
      typeof (rawInvoice as any)?.subscription === 'string'
        ? (rawInvoice as any)?.subscription
        : (rawInvoice as any)?.subscription?.id,
      120,
    );

  const explicitOrderId =
    toPositiveInt((invoice as any)?.metadata?.orderId)
    ?? toPositiveInt((rawInvoice as any)?.metadata?.orderId)
    ?? toPositiveInt((paymentIntent as any)?.metadata?.orderId);
  const metadataUserId =
    toPositiveInt((invoice as any)?.metadata?.userId)
    ?? toPositiveInt((rawInvoice as any)?.metadata?.userId)
    ?? toPositiveInt((paymentIntent as any)?.metadata?.userId);

  const planOrder = await resolvePlanOrderFromInvoiceContext({
    explicitOrderId,
    invoiceId,
    paymentIntentId,
    subscriptionId,
    userId: metadataUserId,
  });

  const user =
    (metadataUserId
      ? await prisma.users.findFirst({ where: { id: metadataUserId } })
      : null)
    ?? (planOrder?.user_id
      ? await prisma.users.findFirst({ where: { id: planOrder.user_id } })
      : null)
    ?? (await getUserFromPayload(prisma, payload, metadataUserId));

  if (!user) {
    log.error('[STRIPE_WH] User not found in invoice event', {
      eventType: payload.type,
      eventId: payload.id,
    });
    return;
  }

  const currency =
    toCurrencyUpper((invoice as any)?.currency)
    ?? toCurrencyUpper(paymentIntent?.currency);
  const amount =
    amountFromMinorUnits((invoice as any)?.amount_paid)
    ?? amountFromMinorUnits((invoice as any)?.amount_due)
    ?? amountFromMinorUnits(paymentIntent?.amount);

  if (payload.type === StripeEvents.INVOICE_PAYMENT_FAILED) {
    const failureContext = paymentIntent
      ? resolveStripePaymentFailureContext(paymentIntent)
      : null;
    const reason = resolvePaymentFailureReasonForInvoice({ invoice, failureContext });

    if (planOrder && planOrder.status === OrderStatus.PENDING) {
      await prisma.orders.update({
        where: { id: planOrder.id },
        data: { status: OrderStatus.FAILED },
      });
    }

    try {
      await manyChat.addTagToUser(user, 'FAILED_PAYMENT');
    } catch (e) {
      log.error('[STRIPE_WH] Error adding FAILED_PAYMENT tag', {
        error: e instanceof Error ? e.message : e,
      });
    }

    try {
      await ingestAnalyticsEvents({
        prisma,
        events: [
          {
            eventId: `stripe:${payload.id}:payment_failed`.slice(0, 80),
            eventName: 'payment_failed',
            eventCategory: 'purchase',
            eventTs: new Date().toISOString(),
            userId: user.id,
            currency,
            amount,
            metadata: {
              provider: 'stripe',
              reason,
              reason_detail: failureContext?.reason ?? null,
              orderId: planOrder?.id ?? null,
              orderType: 'plan',
              stripeSubscriptionId: subscriptionId,
              stripeInvoiceId: invoiceId,
              stripePaymentIntentId: paymentIntentId,
              decline_code: failureContext?.declineCode ?? null,
              stripe_error_type: failureContext?.stripeErrorType ?? null,
              stripe_error_code: failureContext?.stripeErrorCode ?? null,
              stripe_next_action_type: failureContext?.nextActionType ?? null,
              requires_3ds: failureContext?.requires3ds ?? false,
              network: failureContext?.networkName ?? null,
              billing_reason: toNullableString((invoice as any)?.billing_reason, 80),
              attempt_count: Number((invoice as any)?.attempt_count ?? 0) || 0,
            },
          },
        ],
        sessionUserId: user.id,
      });
    } catch (e) {
      log.debug('[STRIPE_WH] analytics payment_failed skipped (invoice)', {
        error: e instanceof Error ? e.message : e,
      });
    }
    return;
  }

  if (payload.type === StripeEvents.INVOICE_PAID) {
    if (planOrder) {
      const patch: Record<string, string> = {};
      if (invoiceId && planOrder.invoice_id !== invoiceId) patch.invoice_id = invoiceId;
      if (subscriptionId && planOrder.txn_id !== subscriptionId) patch.txn_id = subscriptionId;
      if (Object.keys(patch).length > 0) {
        await prisma.orders.update({
          where: { id: planOrder.id },
          data: patch,
        });
      }
    }

    try {
      await ingestAnalyticsEvents({
        prisma,
        events: [
          {
            eventId: `stripe:${payload.id}:invoice_paid`.slice(0, 80),
            eventName: 'invoice_paid',
            eventCategory: 'purchase',
            eventTs: new Date().toISOString(),
            userId: user.id,
            currency,
            amount,
            metadata: {
              provider: 'stripe',
              orderId: planOrder?.id ?? null,
              stripeSubscriptionId: subscriptionId,
              stripeInvoiceId: invoiceId,
              stripePaymentIntentId: paymentIntentId,
              billing_reason: toNullableString((invoice as any)?.billing_reason, 80),
              attempt_count: Number((invoice as any)?.attempt_count ?? 0) || 0,
            },
          },
        ],
        sessionUserId: user.id,
      });
    } catch (e) {
      log.debug('[STRIPE_WH] analytics invoice_paid skipped', {
        error: e instanceof Error ? e.message : e,
      });
    }

    if (planOrder && planOrder.status === OrderStatus.PAID) {
      const plan = planOrder.plan_id
        ? await prisma.plans.findFirst({ where: { id: planOrder.plan_id } })
        : null;

      try {
        const billingReason = toNullableString((invoice as any)?.billing_reason, 80);
        await ingestPaymentSuccessEvent({
          prisma,
          provider: 'stripe',
          providerEventId: payload.id,
          userId: user.id,
          orderId: planOrder.id,
          planId: planOrder.plan_id ?? null,
          amount: Number(planOrder.total_price) || amount || 0,
          currency: plan?.moneda?.toUpperCase?.() ?? currency,
          isRenewal: billingReason === 'subscription_cycle',
          eventTs: new Date(),
          metadata: {
            stripeInvoiceId: invoiceId,
            stripeSubscriptionId: subscriptionId,
            stripePaymentIntentId: paymentIntentId,
          },
        });
      } catch (e) {
        log.debug('[STRIPE_WH] analytics payment_success skipped (invoice_paid)', {
          error: e instanceof Error ? e.message : e,
        });
      }
    }
  }
};

const handleCheckoutSessionCompletedEvent = async (payload: Stripe.Event): Promise<void> => {
  const session = payload.data.object as Stripe.Checkout.Session;
  const metadataOrderId = toPositiveInt((session as any)?.metadata?.orderId);
  const metadataUserId = toPositiveInt((session as any)?.metadata?.userId);
  const subscriptionId = toNullableString(
    typeof (session as any)?.subscription === 'string'
      ? (session as any)?.subscription
      : (session as any)?.subscription?.id,
    120,
  );
  const invoiceId = toNullableString(
    typeof (session as any)?.invoice === 'string'
      ? (session as any)?.invoice
      : (session as any)?.invoice?.id,
    120,
  );
  const paymentIntentId = toNullableString(
    typeof (session as any)?.payment_intent === 'string'
      ? (session as any)?.payment_intent
      : (session as any)?.payment_intent?.id,
    120,
  );

  const planOrder =
    (metadataOrderId
      ? await prisma.orders.findFirst({ where: { id: metadataOrderId } })
      : null)
    ?? (invoiceId
      ? await prisma.orders.findFirst({
          where: { invoice_id: invoiceId },
          orderBy: { id: 'desc' },
        })
      : null)
    ?? (subscriptionId
      ? await prisma.orders.findFirst({
          where: { txn_id: subscriptionId },
          orderBy: [{ date_order: 'desc' }, { id: 'desc' }],
        })
      : null);

  const user =
    (metadataUserId
      ? await prisma.users.findFirst({ where: { id: metadataUserId } })
      : null)
    ?? (planOrder?.user_id
      ? await prisma.users.findFirst({ where: { id: planOrder.user_id } })
      : null)
    ?? (await getUserFromPayload(prisma, payload, metadataUserId));

  if (!user) {
    log.error('[STRIPE_WH] User not found in checkout.session.completed', {
      eventType: payload.type,
      eventId: payload.id,
    });
    return;
  }

  if (planOrder) {
    const patch: Record<string, string> = {};
    if (invoiceId && planOrder.invoice_id !== invoiceId) patch.invoice_id = invoiceId;
    if (subscriptionId && planOrder.txn_id !== subscriptionId) patch.txn_id = subscriptionId;
    if (!subscriptionId && paymentIntentId && planOrder.invoice_id !== paymentIntentId) {
      patch.invoice_id = paymentIntentId;
    }
    if (Object.keys(patch).length > 0) {
      await prisma.orders.update({
        where: { id: planOrder.id },
        data: patch,
      });
    }
  }

  try {
    await ingestAnalyticsEvents({
      prisma,
      events: [
        {
          eventId: `stripe:${payload.id}:checkout_completed`.slice(0, 80),
          eventName: 'checkout_completed',
          eventCategory: 'checkout',
          eventTs: new Date().toISOString(),
          userId: user.id,
          metadata: {
            provider: 'stripe',
            orderId: planOrder?.id ?? metadataOrderId ?? null,
            stripeSubscriptionId: subscriptionId,
            stripeInvoiceId: invoiceId,
            stripePaymentIntentId: paymentIntentId,
            mode: toNullableString((session as any)?.mode, 40),
          },
        },
      ],
      sessionUserId: user.id,
    });
  } catch (e) {
    log.debug('[STRIPE_WH] analytics checkout_completed skipped', {
      error: e instanceof Error ? e.message : e,
    });
  }
};

const resolvePaymentIntentById = async (
  paymentIntentId: string,
): Promise<Stripe.PaymentIntent | null> => {
  if (!paymentIntentId) return null;
  // Try OXXO account first (separate Stripe account), then fall back to main Stripe.
  if (isStripeOxxoConfigured()) {
    try {
      const oxxoPi = await stripeOxxoInstance.paymentIntents.retrieve(paymentIntentId);
      return oxxoPi as Stripe.PaymentIntent;
    } catch {
      // ignore
    }
  }

  try {
    const mainPi = await stripeInstance.paymentIntents.retrieve(paymentIntentId);
    return mainPi as Stripe.PaymentIntent;
  } catch {
    return null;
  }
};

const resolvePaymentIntent = async (
  pi: Stripe.PaymentIntent,
): Promise<Stripe.PaymentIntent> => {
  const paymentIntentId = typeof (pi as any)?.id === 'string' ? String((pi as any).id) : '';
  const hasMeta =
    Boolean((pi as any)?.metadata?.orderId)
    || Boolean((pi as any)?.metadata?.productOrderId)
    || Boolean((pi as any)?.metadata?.userId);

  if (!paymentIntentId || hasMeta) return pi;
  const resolved = await resolvePaymentIntentById(paymentIntentId);
  // If we can't retrieve, keep the original event object.
  return resolved ?? pi;
};

const resolveInvoice = async (
  rawInvoice: Stripe.Invoice,
): Promise<Stripe.Invoice> => {
  const invoiceId = toNullableString((rawInvoice as any)?.id, 120);
  if (!invoiceId) return rawInvoice;
  try {
    return await stripeInstance.invoices.retrieve(invoiceId, {
      expand: ['payment_intent'],
    }) as Stripe.Invoice;
  } catch {
    return rawInvoice;
  }
};

const resolveInvoicePaymentIntent = async (
  invoice: Stripe.Invoice,
): Promise<Stripe.PaymentIntent | null> => {
  const paymentIntentRef = (invoice as any)?.payment_intent;
  if (!paymentIntentRef) return null;

  if (typeof paymentIntentRef === 'string') {
    return resolvePaymentIntentById(paymentIntentRef);
  }

  const paymentIntent = paymentIntentRef as Stripe.PaymentIntent;
  if (!paymentIntent?.id) return null;
  return resolvePaymentIntent(paymentIntent);
};

const shouldHandleEvent = (payload: Stripe.Event): boolean => {
  switch (payload.type) {
    case StripeEvents.PAYMENT_INTENT_SUCCEEDED:
    case StripeEvents.PAYMENT_INTENT_FAILED:
    case StripeEvents.INVOICE_PAYMENT_FAILED:
    case StripeEvents.INVOICE_PAID:
    case StripeEvents.CHECKOUT_SESSION_COMPLETED:
      return true;
    default:
      log.info('[STRIPE_WH] Ignoring unsupported Stripe invoice event', { eventType: payload.type, eventId: payload.id });
      return false;
  }
};

const getUserFromPayload = async (
  prismaClient: PrismaClient,
  payload: Stripe.Event,
  metadataUserId?: number | null,
) => {
  if (metadataUserId) {
    const byId = await prismaClient.users.findFirst({
      where: { id: metadataUserId },
    });
    if (byId) return byId;
  }

  const customerId = resolveStripeCustomerIdFromObject(payload.data.object as any);
  if (!customerId) return null;

  const user = await prismaClient.users.findFirst({
    where: {
      stripe_cusid: customerId,
    },
  });

  return user;
};
