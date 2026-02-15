import { Request } from 'express';
import { PaypalEvent } from './events';
import { subscribe } from '../../subscriptions/services/subscribe';
import { prisma } from '../../../db';
import { log } from '../../../server';
import { PaymentService } from '../../subscriptions/services/types';
import { cancelSubscription } from '../../subscriptions/services/cancelSubscription';
import { getPlanKey } from '../../../utils/getPlanKey';
import { OrderStatus } from '../../subscriptions/interfaces/order-status.interface';
import { addDays } from 'date-fns';
import axios from 'axios';
import { paypal } from '../../../paypal';
import { updateFtpUserInfo } from '../../subscriptions/changeSubscriptionPlan/updateSubscription';
import { manyChat } from '../../../many-chat';
import { ingestAnalyticsEvents } from '../../../analytics';

const parsePaypalPayload = (req: Request): Record<string, any> => {
  const body = req.body as unknown;

  if (Buffer.isBuffer(body)) {
    const raw = body.toString('utf8').trim();
    return raw ? (JSON.parse(raw) as Record<string, any>) : {};
  }

  if (typeof body === 'string') {
    const raw = body.trim();
    return raw ? (JSON.parse(raw) as Record<string, any>) : {};
  }

  if (typeof body === 'object' && body) {
    return body as Record<string, any>;
  }

  return {};
};

const getPaypalSubscriptionId = (payload: Record<string, any>): string | null => {
  const resource = payload?.resource ?? {};
  const candidates = [
    resource?.billing_agreement_id,
    resource?.supplementary_data?.related_ids?.subscription_id,
    resource?.subscription_id,
    resource?.id,
  ];

  const resolved = candidates.find(
    (value) => typeof value === 'string' && value.trim().length > 0,
  );

  return (resolved as string | undefined) ?? null;
};

export const paypalSubscriptionWebhook = async (req: Request) => {
  const payload = parsePaypalPayload(req);

  log.info('[PAYPAL_WH] Handling Paypal webhook', {
    eventType: payload?.event_type ?? null,
    eventId: payload?.id ?? payload?.event_id ?? null,
  });

  const subId = getPaypalSubscriptionId(payload);
  if (!subId) {
    log.error(
      `[PAYPAL_WH] Could not resolve subscription id for event ${payload?.event_type}`,
    );
    return;
  }

  const order = await prisma.orders.findFirst({
    where: {
      txn_id: subId,
    },
  });

  if (!order) {
    // Probably never happening (in prod) but just in case
    log.error('[PAYPAL_WH] Order not found for subscription webhook', {
      eventType: payload?.event_type ?? null,
    });
    return;
  }

  const planId = order.plan_id;

  if (!planId) {
    log.error(`[PAYPAL_WH] Order does not have a plan ID in our DB.`);
    return;
  }

  const plan = await prisma.plans.findFirst({
    where: { id: planId },
  });

  if (!plan) {
    log.error('[PAYPAL_WH] Plan not found for subscription webhook');
    return;
  }

  const user = await prisma.users.findFirst({
    where: {
      id: order.user_id,
    },
  });

  if (!user) {
    log.error('[PAYPAL_WH] User not found for subscription webhook');
    return;
  }

  const activeSub = await prisma.descargasUser.findFirst({
    where: {
      AND: [
        {
          user_id: user.id,
        },
        {
          date_end: {
            gt: new Date(),
          },
        },
      ],
    },
  });

  // if (activeSub) {
  //   log.info(
  //     `[PAYPAL_WH] User ${user.id} already has an active subscription, ignoring event.`,
  //   );
  //   return;
  // }

  switch (payload.event_type) {
    case PaypalEvent.BILLING_SUBSCRIPTION_ACTIVATED:
    case PaypalEvent.BILLING_SUBSCRIPTION_REACTIVATED:
      log.info('[PAYPAL_WH] Activating subscription', {
        eventType: payload.event_type ?? null,
        eventId: payload?.id ?? payload?.event_id ?? null,
      });

      try {
        await manyChat.addTagToUser(user, 'SUCCESSFUL_PAYMENT');
      } catch (e) {
        log.error('[PAYPAL_WH] Error while adding ManyChat tag', {
          errorType: e instanceof Error ? e.name : typeof e,
        });
      }

      await subscribe({
        prisma,
        user,
        plan: plan!,
        subId,
        expirationDate: new Date(
          payload.resource.billing_info.next_billing_time,
        ),
        service: PaymentService.PAYPAL,
      });

      break;
    case PaypalEvent.BILLING_SUBSCRIPTION_UPDATED:
      log.info('[PAYPAL_WH] Updating subscription', {
        status: payload.resource.status ?? null,
        eventId: payload?.id ?? payload?.event_id ?? null,
      });

      if (activeSub) {
        const subscriptionOrder = await prisma.orders.findFirst({
          where: {
            txn_id: subId,
          },
        });

        if (!subscriptionOrder) {
          log.error(
            '[PAYPAL_WH] Subscription updated, but matching order not found',
          );
          return;
        }

        const currentPlan = await prisma.plans.findFirst({
          where: {
            id: subscriptionOrder?.plan_id!,
          },
        });

        if (!currentPlan) {
          log.error(
            '[PAYPAL_WH] Current plan not found during subscription update',
          );
          return;
        }

        const paypalPlanKey = getPlanKey(PaymentService.PAYPAL);
        const incomingPaypalPlanId =
          typeof payload.resource?.plan_id === 'string'
            ? payload.resource.plan_id
            : null;
        const currentPaypalPlanId = currentPlan[paypalPlanKey] as string | null;

        if (
          incomingPaypalPlanId &&
          currentPaypalPlanId &&
          currentPaypalPlanId !== incomingPaypalPlanId
        ) {
          log.info('[PAYPAL_WH] PayPal plan changed; updating subscription plan');

          const newPlan = await prisma.plans.findFirst({
            where: {
              [getPlanKey(PaymentService.PAYPAL)]: incomingPaypalPlanId,
            },
          });

          if (!newPlan) {
            log.error(
              '[PAYPAL_WH] New plan not found for PayPal plan change',
            );
            return;
          }

          return await updateFtpUserInfo({
            subscription: activeSub,
            user,
            subscriptionOrder,
            newPlan,
          });
        }
      }

      if (payload.resource.status === 'ACTIVE') {
        try {
          await manyChat.addTagToUser(user, 'SUCCESSFUL_PAYMENT');
        } catch (e) {
          log.error('[PAYPAL_WH] Error while adding ManyChat tag', {
            errorType: e instanceof Error ? e.name : typeof e,
          });
        }

        await subscribe({
          prisma,
          user,
          plan: plan!,
          subId,
          expirationDate: new Date(
            payload.resource.billing_info.next_billing_time,
          ),
          service: PaymentService.PAYPAL,
        });

        break;
      } else {
        log.info(
          `[PAYPAL_WH] Subscription update with status ${payload.resource.status}, not doing anything`,
        );
        break;
      }
    case PaypalEvent.BILLING_SUBSCRIPTION_CANCELLED:
      log.info('[PAYPAL_WH] Cancelling subscription', {
        eventId: payload?.id ?? payload?.event_id ?? null,
      });

      await cancelSubscription({
        prisma,
        user,
        plan: plan[getPlanKey(PaymentService.PAYPAL)]!,
        service: PaymentService.PAYPAL,
        reason: OrderStatus.CANCELLED,
      });

      break;
    case PaypalEvent.BILLING_SUBSCRIPTION_SUSPENDED:
    case PaypalEvent.BILLING_SUBSCRIPTION_EXPIRED:
      log.info('[PAYPAL_WH] Subscription event', {
        eventType: payload.event_type ?? null,
        eventId: payload?.id ?? payload?.event_id ?? null,
      });

      // Internal analytics: treat provider-side expiration as involuntary cancellation.
      try {
        await ingestAnalyticsEvents({
          prisma,
          events: [
            {
              eventId: `paypal:${payload.id || payload.event_id}:subscription_cancel_involuntary`.slice(0, 80),
              eventName: 'subscription_cancel_involuntary',
              eventCategory: 'retention',
              eventTs: new Date().toISOString(),
              userId: user.id,
              metadata: {
                provider: 'paypal',
                reason:
                  payload.event_type === PaypalEvent.BILLING_SUBSCRIPTION_SUSPENDED
                    ? 'subscription_suspended'
                    : 'subscription_expired',
                paypalSubscriptionId: subId,
                orderId: order.id,
              },
            },
          ],
          sessionUserId: user.id,
        });
      } catch (e) {
        log.debug('[PAYPAL_WH] analytics involuntary cancellation skipped', {
          error: e instanceof Error ? e.message : e,
        });
      }

      await cancelSubscription({
        prisma,
        user,
        plan: plan[getPlanKey(PaymentService.PAYPAL)]!,
        service: PaymentService.PAYPAL,
        reason:
          payload.event_type === PaypalEvent.BILLING_SUBSCRIPTION_SUSPENDED
            ? OrderStatus.FAILED
            : OrderStatus.EXPIRED,
      });

      break;
    case PaypalEvent.PAYMENT_SALE_COMPLETED: {
      log.info('[PAYPAL_WH] Payment completed; renewing subscription', {
        eventId: payload?.id ?? payload?.event_id ?? null,
      });

      const existingOrder = await prisma.orders.findFirst({
        where: {
          txn_id: subId,
        },
      });

      if (!existingOrder) {
        log.error(
          '[PAYPAL_WH] Renewal skipped; matching order not found',
        );
        return;
      }

      const orderPlan = await prisma.plans.findFirst({
        where: {
          id: existingOrder.plan_id as number,
        },
      });
      if (!orderPlan) {
        log.error(
          `[PAYPAL_WH] Plan with id ${existingOrder.plan_id} not found for renewal`,
        );
        return;
      }

      const paypalToken = await paypal.getToken();

      let expirationDate: Date = addDays(new Date(), 30);

      try {
        const subscription = (
          await axios(
            `${paypal.paypalUrl()}/v1/billing/subscriptions/${subId}`,
            {
              headers: {
                Authorization: `Bearer ${paypalToken}`,
              },
            },
          )
        ).data;

        if (subscription) {
          expirationDate = new Date(
            subscription.billing_info.next_billing_time,
          );
        }
      } catch (e) {
        log.error('[PAYPAL_WH] Error while getting subscription', {
          errorType: e instanceof Error ? e.name : typeof e,
        });
      }

      try {
        // Renewal lifecycle tag (avoid triggering first-payment sequences every month).
        await manyChat.addTagToUser(user, 'SUBSCRIPTION_RENEWED');
      } catch (e) {
        log.error('[PAYPAL_WH] Error while adding ManyChat tag', {
          errorType: e instanceof Error ? e.name : typeof e,
        });
      }

      await subscribe({
        prisma,
        user,
        plan: orderPlan!,
        subId,
        expirationDate,
        service: PaymentService.PAYPAL,
      });

      break;
    }

    case PaypalEvent.BILLING_SUBSCRIPTION_PAYMENT_FAILED:
    case PaypalEvent.PAYMENT_SALE_DENIED: {
      log.info(
        `[PAYPAL_WH] Payment failed (${payload.event_type})`,
      );

      const dunningEnabled = (process.env.DUNNING_ENABLED || '0').trim() === '1';

      try {
        await manyChat.addTagToUser(user, 'FAILED_PAYMENT');
      } catch (e) {
        log.error('[PAYPAL_WH] Error adding FAILED_PAYMENT tag', {
          errorType: e instanceof Error ? e.name : typeof e,
        });
      }

      // Internal analytics: payment failed (billing). When dunning is enabled,
      // do NOT mark this as an involuntary cancellation yet.
      try {
        await ingestAnalyticsEvents({
          prisma,
          events: [
            {
              eventId: `paypal:${payload.id || payload.event_id}:payment_failed`.slice(0, 80),
              eventName: 'payment_failed',
              eventCategory: 'purchase',
              eventTs: new Date().toISOString(),
              userId: user.id,
              currency: plan?.moneda?.toUpperCase?.() ?? null,
              amount: Number(plan?.price) || 0,
              metadata: {
                provider: 'paypal',
                reason:
                  payload.event_type === PaypalEvent.BILLING_SUBSCRIPTION_PAYMENT_FAILED
                    ? 'billing_subscription_payment_failed'
                    : 'payment_sale_denied',
                paypalSubscriptionId: subId,
                orderId: order.id,
              },
            },
            ...(dunningEnabled
              ? []
              : [
                  {
                    eventId: `paypal:${payload.id || payload.event_id}:subscription_cancel_involuntary`.slice(0, 80),
                    eventName: 'subscription_cancel_involuntary',
                    eventCategory: 'retention' as const,
                    eventTs: new Date().toISOString(),
                    userId: user.id,
                    metadata: {
                      provider: 'paypal',
                      reason:
                        payload.event_type === PaypalEvent.BILLING_SUBSCRIPTION_PAYMENT_FAILED
                          ? 'billing_subscription_payment_failed'
                          : 'payment_sale_denied',
                      paypalSubscriptionId: subId,
                      orderId: order.id,
                    },
                  },
                ]),
          ],
          sessionUserId: user.id,
        });
      } catch (e) {
        log.debug('[PAYPAL_WH] analytics payment_failed/involuntary_cancel skipped', {
          error: e instanceof Error ? e.message : e,
        });
      }

      if (!dunningEnabled) {
        await cancelSubscription({
          prisma,
          user,
          plan: plan[getPlanKey(PaymentService.PAYPAL)]!,
          service: PaymentService.PAYPAL,
          reason: OrderStatus.FAILED,
        });
      }

      break;
    }
    default:
      log.info(`[PAYPAL_WH] Event type ${payload.event_type} not handled`);
      break;
  }
};
