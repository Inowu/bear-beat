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

const toPositiveInt = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
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
        return;
      }

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
