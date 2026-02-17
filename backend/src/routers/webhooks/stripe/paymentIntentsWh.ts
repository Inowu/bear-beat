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

export const stripeInvoiceWebhook = async (req: Request) => {
  const payloadStr = getStripeWebhookBody(req);
  const payload: Stripe.Event = JSON.parse(payloadStr);

  if (!shouldHandleEvent(payload)) return;

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

const resolvePaymentIntent = async (
  pi: Stripe.PaymentIntent,
): Promise<Stripe.PaymentIntent> => {
  const paymentIntentId = typeof (pi as any)?.id === 'string' ? String((pi as any).id) : '';
  const hasMeta =
    Boolean((pi as any)?.metadata?.orderId)
    || Boolean((pi as any)?.metadata?.productOrderId)
    || Boolean((pi as any)?.metadata?.userId);

  if (!paymentIntentId || hasMeta) return pi;

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
    // If we can't retrieve, keep the original event object.
    return pi;
  }
};

const shouldHandleEvent = (payload: Stripe.Event): boolean => {
  switch (payload.type) {
    case StripeEvents.PAYMENT_INTENT_SUCCEEDED:
    case StripeEvents.PAYMENT_INTENT_FAILED:
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

  const { customer } = payload.data.object as Stripe.PaymentIntent;

  const user = await prismaClient.users.findFirst({
    where: {
      stripe_cusid: typeof customer === 'string' ? customer : customer?.id,
    },
  });

  return user;
};
