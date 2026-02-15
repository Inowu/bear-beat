import { EventResponse } from 'conekta';
import { Orders, Plans, Users, product_orders, products } from '@prisma/client';
import { Request } from 'express';
import { addDays } from 'date-fns';
import { subscribe } from '../../subscriptions/services/subscribe';
import { prisma } from '../../../db';
import { log } from '../../../server';
import { cancelSubscription } from '../../subscriptions/services/cancelSubscription';
import { getPlanKey } from '../../../utils/getPlanKey';
import { cancelOrder } from '../../subscriptions/services/cancelOrder';
import { ConektaEvents } from './events';
import { PaymentService } from '../../subscriptions/services/types';
import { sendPlanActivatedEmail } from '../../../email';
import { OrderStatus } from '../../subscriptions/interfaces/order-status.interface';
import { addGBToAccount } from '../../products/services/addGBToAccount';
import { manyChat } from '../../../many-chat';
import { ingestAnalyticsEvents } from '../../../analytics';

export const conektaSubscriptionWebhook = async (req: Request) => {
  const payload: EventResponse = JSON.parse(req.body as any);

  if (!shouldHandleEvent(payload)) return;

  const user = await getCustomerIdFromPayload(payload);

  if (!user) {
    log.error('[CONEKTA_WH] User not found in event', {
      eventType: payload.type ?? null,
      eventId: (payload as any)?.id ?? null,
    });
    return;
  }

  const plan = await getPlanFromPayload(payload);

  if (!plan && payload.type?.startsWith('subscription')) {
    log.error('[CONEKTA_WH] Plan not found in event', {
      eventType: payload.type ?? null,
      eventId: (payload as any)?.id ?? null,
    });

    return;
  }

  const subscription = payload.data?.object;

  const isProduct = Boolean(payload.data?.object?.metadata?.isProduct);

  switch (payload.type) {
    case ConektaEvents.SUB_PAID:
      log.info('[CONEKTA_WH] Creating subscription', { eventId: (payload as any)?.id ?? null });

      try {
        await manyChat.addTagToUser(user, 'SUCCESSFUL_PAYMENT');
      } catch (e) {
        log.error('[CONEKTA_WH] Error while adding ManyChat tag', {
          errorType: e instanceof Error ? e.name : typeof e,
        });
      }

      await subscribe({
        subId: subscription.id,
        prisma,
        user,
        plan: plan!,
        service: PaymentService.CONEKTA,
        expirationDate: plan
          ? addDays(new Date(), Number(plan.duration))
          : addDays(new Date(), 30),
      });
      break;
    case ConektaEvents.SUB_UPDATED:
      log.info('[CONEKTA_WH] Updating subscription', {
        status: subscription.status,
        eventId: (payload as any)?.id ?? null,
      });
      if (payload.data?.object.status !== 'active') {
        // Internal analytics: provider-side cancellation (best-effort involuntary signal).
        try {
          await ingestAnalyticsEvents({
            prisma,
            events: [
              {
                eventId: `conekta:${payload.id}:subscription_cancel_involuntary`.slice(0, 80),
                eventName: 'subscription_cancel_involuntary',
                eventCategory: 'retention',
                eventTs: new Date().toISOString(),
                userId: user.id,
                metadata: {
                  provider: 'conekta',
                  reason: String(payload.data?.object.status || 'unknown'),
                  conektaSubscriptionId: subscription.id,
                  planId: plan?.id ?? null,
                },
              },
            ],
            sessionUserId: user.id,
          });
        } catch (e) {
          log.debug('[CONEKTA_WH] analytics involuntary cancellation skipped', {
            error: e instanceof Error ? e.message : e,
          });
        }

        await cancelSubscription({
          prisma,
          user,
          plan: subscription.plan.id,
          service: PaymentService.CONEKTA,
        });
      }
      break;
    case ConektaEvents.SUB_CANCELED:
      log.info('[CONEKTA_WH] Canceling subscription', { eventId: (payload as any)?.id ?? null });
      await cancelSubscription({
        prisma,
        user,
        plan: subscription.plan.id,
        service: PaymentService.CONEKTA,
      });
      break;
    case ConektaEvents.ORDER_VOIDED:
    case ConektaEvents.ORDER_DECLINED: {
      let orderId = toPositiveInt(payload.data?.object?.metadata?.orderId);
      let orderSource = 'metadata.orderId';

      if (!orderId && !isProduct) {
        const resolvedOrder = await resolveSubscriptionOrderFromPayload(payload);
        if (resolvedOrder) {
          orderId = resolvedOrder.id;
          orderSource = resolvedOrder.source;
        }
      }

      log.info('[CONEKTA_WH] Payment failed, canceling order', {
        orderSource,
        hasOrderId: Boolean(orderId),
        isProduct,
      });

      if (orderId && !isProduct) {
        const order = await prisma.orders.findFirst({
          where: { id: Number(orderId) },
          select: { user_id: true },
        });
        if (order?.user_id) {
          const orderUser = await prisma.users.findFirst({
            where: { id: order.user_id },
          });
          if (orderUser) {
            try {
              await manyChat.addTagToUser(orderUser, 'FAILED_PAYMENT');
            } catch (e) {
              log.error('[CONEKTA_WH] Error adding FAILED_PAYMENT tag', {
                errorType: e instanceof Error ? e.name : typeof e,
              });
            }
          }
        }
      }

      // Internal analytics: payment failed (cash/spei).
      try {
        await ingestAnalyticsEvents({
          prisma,
          events: [
            {
              eventId: `conekta:${payload.id}:payment_failed`.slice(0, 80),
              eventName: 'payment_failed',
              eventCategory: 'purchase',
              eventTs: new Date().toISOString(),
              userId: user.id,
              currency: plan?.moneda?.toUpperCase?.() ?? 'MXN',
              amount: Number(plan?.price) || null,
              metadata: {
                provider: 'conekta',
                reason: payload.type,
                conektaOrderId: payload.data?.object?.id ?? null,
                orderId: orderId ?? null,
              },
            },
          ],
          sessionUserId: user.id,
        });
      } catch (e) {
        log.debug('[CONEKTA_WH] analytics payment_failed skipped', {
          error: e instanceof Error ? e.message : e,
        });
      }

      await cancelOrder({
        prisma,
        orderId,
        isProduct,
        reason: OrderStatus.FAILED,
      });

      break;
    }
    case ConektaEvents.ORDER_EXPIRED: {
      let orderId = toPositiveInt(payload.data?.object?.metadata?.orderId);
      let orderSource = 'metadata.orderId';

      if (!orderId && !isProduct) {
        const resolvedOrder = await resolveSubscriptionOrderFromPayload(payload);
        if (resolvedOrder) {
          orderId = resolvedOrder.id;
          orderSource = resolvedOrder.source;
        }
      }

      log.info('[CONEKTA_WH] Canceling order', {
        orderSource,
        hasOrderId: Boolean(orderId),
        isProduct,
      });

      // Internal analytics: payment expired (cash/spei).
      try {
        await ingestAnalyticsEvents({
          prisma,
          events: [
            {
              eventId: `conekta:${payload.id}:payment_failed`.slice(0, 80),
              eventName: 'payment_failed',
              eventCategory: 'purchase',
              eventTs: new Date().toISOString(),
              userId: user.id,
              currency: plan?.moneda?.toUpperCase?.() ?? 'MXN',
              amount: Number(plan?.price) || null,
              metadata: {
                provider: 'conekta',
                reason: 'order_expired',
                conektaOrderId: payload.data?.object?.id ?? null,
                orderId: orderId ?? null,
              },
            },
          ],
          sessionUserId: user.id,
        });
      } catch (e) {
        log.debug('[CONEKTA_WH] analytics payment_failed skipped', {
          error: e instanceof Error ? e.message : e,
        });
      }

      await cancelOrder({
        prisma,
        orderId,
        isProduct,
        reason: OrderStatus.EXPIRED,
      });

      break;
    }
    case ConektaEvents.ORDER_CHARGED_BACK:
    case ConektaEvents.ORDER_CANCELED: {
      let orderId = toPositiveInt(payload.data?.object?.metadata?.orderId);
      let orderSource = 'metadata.orderId';

      if (!orderId && !isProduct) {
        const resolvedOrder = await resolveSubscriptionOrderFromPayload(payload);
        if (resolvedOrder) {
          orderId = resolvedOrder.id;
          orderSource = resolvedOrder.source;
        }
      }

      log.info('[CONEKTA_WH] Canceling order', {
        orderSource,
        hasOrderId: Boolean(orderId),
        isProduct,
      });
      await cancelOrder({
        prisma,
        orderId,
        isProduct,
      });

      break;
    }
    case ConektaEvents.ORDER_PAID: {
      const paymentMethodObj = payload.data?.object?.charges?.data?.[0]?.payment_method;
      const pmObjectType = typeof paymentMethodObj?.object === 'string' ? paymentMethodObj.object : '';
      if (pmObjectType.startsWith('card')) {
        log.info('[CONEKTA_WH] Ignoring card payment event', {
          eventType: payload.type ?? null,
          eventId: (payload as any)?.id ?? null,
        });
        return;
      }

      log.info('[CONEKTA_WH] Paid order event received', {
        eventType: payload.type ?? null,
        eventId: (payload as any)?.id ?? null,
      });

      let orderIdNum = toPositiveInt(payload.data?.object?.metadata?.orderId);
      let orderSource = 'metadata.orderId';

      if (!orderIdNum && !isProduct) {
        const resolvedOrder = await resolveSubscriptionOrderFromPayload(payload);
        if (resolvedOrder) {
          orderIdNum = resolvedOrder.id;
          orderSource = resolvedOrder.source;
        }
      }

      if (!orderIdNum) {
        log.error('[CONEKTA_WH] Order id could not be resolved from event; skipping', {
          eventType: payload.type ?? null,
          eventId: (payload as any)?.id ?? null,
        });
        return;
      }

      log.info('[CONEKTA_WH] Processing paid order', {
        orderSource,
        isProduct,
      });

      let productOrPlan: Plans | products | null = null;
      let order: Orders | product_orders | null = null;

      if (isProduct) {
        log.info('[CONEKTA_WH] Updating product order to paid');

        order = await prisma.product_orders.update({
          where: {
            id: orderIdNum,
          },
          data: {
            status: OrderStatus.PAID,
          },
        });
      } else {
        order = (await prisma.orders.update({
          where: {
            id: orderIdNum,
          },
          data: {
            status: OrderStatus.PAID,
          },
        })) as Orders;

        productOrPlan = (await prisma.plans.findFirst({
          where: {
            id: order.plan_id!,
          },
        })) as Plans;
      }

      if (!order || !productOrPlan) {
        log.error('[CONEKTA_WH] Order or product not found; skipping', { isProduct });
        return;
      }

      if (isProduct) {
        await addGBToAccount({
          prisma,
          user,
          orderId: orderIdNum,
        });
      } else {
        try {
          await manyChat.addTagToUser(user, 'SUCCESSFUL_PAYMENT');
        } catch (e) {
          log.error('[CONEKTA_WH] Error while adding ManyChat tag', {
            errorType: e instanceof Error ? e.name : typeof e,
          });
        }

        await subscribe({
          subId: (payload.data?.object as any)?.id ?? subscription.id,
          prisma,
          user,
          orderId: orderIdNum,
          service: PaymentService.CONEKTA,
          expirationDate: addDays(
            new Date(),
            Number(productOrPlan.duration) || 30,
          ),
        });
      }

      try {
        await sendPlanActivatedEmail({
          userId: user.id,
          toEmail: user.email,
          toName: user.username,
          planName: productOrPlan.name,
          price: productOrPlan.price,
          currency: productOrPlan.moneda.toUpperCase(),
          orderId: order.id,
        });
      } catch (e) {
        log.error('[CONEKTA_WH] Plan activated email failed (non-blocking)', {
          errorType: e instanceof Error ? e.name : typeof e,
        });
      }

      break;
    }
    default:
      log.info('[CONEKTA_WH] Unhandled event', { eventType: payload.type ?? null, eventId: (payload as any)?.id ?? null });
  }
};

export const getCustomerIdFromPayload = async (
  payload: EventResponse,
): Promise<Users | null> => {
  let user: Users | null | undefined = null;

  switch (payload.type) {
    case ConektaEvents.SUB_PAID:
    case ConektaEvents.SUB_UPDATED:
    case ConektaEvents.SUB_CANCELED:
      user = await prisma.users.findFirst({
        where: {
          conekta_cusid: payload.data?.object.customer_id,
        },
      });
      break;
    case ConektaEvents.ORDER_VOIDED:
    case ConektaEvents.ORDER_DECLINED:
    case ConektaEvents.ORDER_EXPIRED:
    case ConektaEvents.ORDER_CANCELED:
    case ConektaEvents.ORDER_CHARGED_BACK: {
      const metadataUserId = toPositiveInt(payload.data?.object?.metadata?.userId);
      if (metadataUserId) {
        user = await prisma.users.findFirst({
          where: { id: metadataUserId },
        });
      }

      if (!user) {
        const ord = await resolveSubscriptionOrderFromPayload(payload);
        if (ord?.user_id) {
          user = await prisma.users.findFirst({
            where: { id: ord.user_id },
          });
        }
      }
      break;
    }
    case ConektaEvents.ORDER_PAID: {
      const userId = payload.data?.object?.metadata?.userId;
      const userIdNum = typeof userId === 'number' ? userId : Number(userId);
      if (userIdNum && !Number.isNaN(userIdNum)) {
        user = await prisma.users.findFirst({
          where: { id: userIdNum },
        });
      }

      if (!user) {
        log.error('[CONEKTA_WH] Trying to find user by email in database');

        user = await prisma.users.findFirst({
          where: {
            email: payload.data?.object?.customer_info?.email,
          },
        });

        if (user && payload.data?.object?.customer_info?.customer_id) {
          await prisma.users.update({
            where: { id: user.id },
            data: {
              conekta_cusid: payload.data.object.customer_info.customer_id,
            },
          });
        }
      }

      if (!user) {
        const ord = await resolveSubscriptionOrderFromPayload(payload);
        if (ord?.user_id) {
          user = await prisma.users.findFirst({
            where: { id: ord.user_id },
          });
        }
      }
    }
    break;
    default:
      break;
  }

  return user;
};

type ResolvedSubscriptionOrder = {
  id: number;
  user_id: number;
  plan_id: number | null;
  source: 'metadata.orderId' | 'invoice_id' | 'txn_id';
};

const resolveSubscriptionOrderFromPayload = async (
  payload: EventResponse,
): Promise<ResolvedSubscriptionOrder | null> => {
  const select = {
    id: true,
    user_id: true,
    plan_id: true,
  } as const;

  const metadataOrderId = toPositiveInt(payload.data?.object?.metadata?.orderId);
  if (metadataOrderId) {
    const byMetadataOrderId = await prisma.orders.findFirst({
      where: { id: metadataOrderId },
      select,
    });
    if (byMetadataOrderId) {
      return {
        ...byMetadataOrderId,
        source: 'metadata.orderId',
      };
    }
  }

  const conektaOrderId = toNonEmptyString(payload.data?.object?.id);
  if (conektaOrderId) {
    const byInvoiceId = await prisma.orders.findFirst({
      where: { invoice_id: conektaOrderId },
      orderBy: { id: 'desc' },
      select,
    });
    if (byInvoiceId) {
      return {
        ...byInvoiceId,
        source: 'invoice_id',
      };
    }
  }

  const txnCandidates = getConektaTxnCandidates(payload, conektaOrderId);
  if (txnCandidates.length > 0) {
    const byTxnId = await prisma.orders.findFirst({
      where: {
        txn_id: {
          in: txnCandidates,
        },
      },
      orderBy: { id: 'desc' },
      select,
    });
    if (byTxnId) {
      return {
        ...byTxnId,
        source: 'txn_id',
      };
    }
  }

  return null;
};

const getConektaTxnCandidates = (
  payload: EventResponse,
  conektaOrderId: string | null,
): string[] => {
  const chargesData = (payload.data?.object as any)?.charges?.data;
  const chargeIds = Array.isArray(chargesData)
    ? chargesData
        .map((charge: any) => toNonEmptyString(charge?.id))
        .filter((id): id is string => Boolean(id))
    : [];

  const candidates = [
    ...(conektaOrderId ? [conektaOrderId] : []),
    ...chargeIds,
  ];

  return Array.from(new Set(candidates));
};

const toPositiveInt = (value: unknown): number | undefined => {
  const parsed =
    typeof value === 'number'
      ? value
      : typeof value === 'string'
        ? Number(value.trim())
        : Number.NaN;

  if (!Number.isInteger(parsed) || parsed <= 0) {
    return undefined;
  }

  return parsed;
};

const toNonEmptyString = (value: unknown): string | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
};

const getPlanFromPayload = async (
  payload: EventResponse,
): Promise<Plans | null> => {
  let plan: Plans | null | undefined = null;

  switch (payload.type) {
    case ConektaEvents.SUB_PAID:
    case ConektaEvents.SUB_UPDATED:
    case ConektaEvents.SUB_CANCELED:
      plan = await prisma.plans.findFirst({
        where: {
          [getPlanKey()]: payload.data?.object.plan_id,
        },
      });
      break;
    default:
      break;
  }

  return plan;
};

const shouldHandleEvent = (payload: EventResponse): boolean => {
  switch (payload.type) {
    case ConektaEvents.SUB_PAID:
    case ConektaEvents.SUB_UPDATED:
    case ConektaEvents.SUB_CANCELED:
    case ConektaEvents.ORDER_VOIDED:
    case ConektaEvents.ORDER_DECLINED:
    case ConektaEvents.ORDER_CANCELED:
    case ConektaEvents.ORDER_PAID:
    case ConektaEvents.ORDER_EXPIRED:
    case ConektaEvents.ORDER_CHARGED_BACK:
      return true;
    default:
      log.info('[CONEKTA_WH] Ignoring unsupported Conekta event', {
        eventType: payload.type ?? null,
        eventId: (payload as any)?.id ?? null,
      });
      return false;
  }
};
