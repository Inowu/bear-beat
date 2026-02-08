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

export const paypalSubscriptionWebhook = async (req: Request) => {
  const payload = JSON.parse(req.body as any);

  log.info(
    `[PAYPAL_WH] Handling Paypal webhook, payload: ${JSON.stringify(payload)}`,
  );

  const subId =
    payload.event_type === PaypalEvent.PAYMENT_SALE_COMPLETED ||
    payload.event_type === PaypalEvent.PAYMENT_SALE_DENIED
      ? payload.resource.billing_agreement_id
      : payload.resource.id;

  const order = await prisma.orders.findFirst({
    where: {
      txn_id: subId,
    },
  });

  if (!order) {
    // Probably never happening (in prod) but just in case
    log.error(`[PAYPAL_WH] Order with txn_id ${subId} not found`);
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
    log.error(`[PAYPAL_WH] Plan with id ${planId} not found`);
    return;
  }

  const user = await prisma.users.findFirst({
    where: {
      id: order.user_id,
    },
  });

  if (!user) {
    log.error(`[PAYPAL_WH] User with id ${order.user_id} not found`);
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
      log.info(
        `[PAYPAL_WH] Activating subscription, subscription id ${payload.resource.id}`,
      );

      try {
        await manyChat.addTagToUser(user, 'SUCCESSFUL_PAYMENT');
      } catch (e) {
        log.error(`[PAYPAL] Error while adding tag to user ${user.id}: ${e}`);
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
      log.info(
        `[PAYPAL_WH] Updating subscription, subscription id ${payload.resource.id}`,
      );

      if (activeSub) {
        const subscriptionOrder = await prisma.orders.findFirst({
          where: {
            txn_id: subId,
          },
        });

        if (!subscriptionOrder) {
          log.error(
            `[PAYPAL_WH] Subscription updated, but order with txn_id ${subId} not found`,
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
            `[PAYPAL_WH] Plan with id ${subscriptionOrder?.plan_id} not found`,
          );
          return;
        }

        if (subscriptionOrder.plan_id !== payload.resource.plan_id) {
          log.info(
            `[PAYPAL_WH] Changing plans for user ${user.id}, from plan ${currentPlan.paypal_plan_id} to plan ${payload.resource.plan_id}`,
          );

          const newPlan = await prisma.plans.findFirst({
            where: {
              [getPlanKey(PaymentService.PAYPAL)]: payload.resource.plan_id,
            },
          });

          if (!newPlan) {
            log.error(
              `[PAYPAL_WH] Error when changing plans, plan with id ${payload.resource.plan_id} not found`,
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
          log.error(`[PAYPAL] Error while adding tag to user ${user.id}: ${e}`);
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
      log.info(
        `[PAYPAL_WH] Cancelling subscription, subscription id ${payload.resource.id}`,
      );

      await cancelSubscription({
        prisma,
        user,
        plan: plan[getPlanKey(PaymentService.PAYPAL)]!,
        service: PaymentService.PAYPAL,
        reason: OrderStatus.CANCELLED,
      });

      break;
    case PaypalEvent.BILLING_SUBSCRIPTION_EXPIRED:
      log.info(
        `[PAYPAL_WH] Subscription expired, subscription id ${payload.resource.id}`,
      );

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
                reason: 'subscription_expired',
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
        reason: OrderStatus.EXPIRED,
      });

      break;
    case PaypalEvent.PAYMENT_SALE_COMPLETED: {
      log.info(
        `[PAYPAL_WH] Payment completed, renovating subscription for user ${user.id}, subscription id ${payload.resource.id}`,
      );

      const existingOrder = await prisma.orders.findFirst({
        where: {
          txn_id: subId,
        },
      });

      if (!existingOrder) {
        log.error(
          `[PAYPAL_WH] Error while renovating paypal subscription for user ${user.id}, order with txn_id ${subId} not found`,
        );
        return;
      }

      const orderPlan = await prisma.plans.findFirst({
        where: {
          id: existingOrder.plan_id as number,
        },
      });

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
        log.error(`[PAYPAL_WH] Error while getting subscription ${e}`);
      }

      try {
        // Renewal lifecycle tag (avoid triggering first-payment sequences every month).
        await manyChat.addTagToUser(user, 'SUBSCRIPTION_RENEWED');
      } catch (e) {
        log.error(`[PAYPAL] Error while adding tag to user ${user.id}: ${e}`);
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

    case PaypalEvent.PAYMENT_SALE_DENIED: {
      log.info(`[PAYPAL_WH] Payment denied, subscription id ${subId}`);

      try {
        await manyChat.addTagToUser(user, 'FAILED_PAYMENT');
      } catch (e) {
        log.error(`[PAYPAL] Error adding FAILED_PAYMENT tag for user ${user.id}: ${e}`);
      }

      // Internal analytics: payment failed + involuntary cancellation.
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
                reason: 'payment_sale_denied',
                paypalSubscriptionId: subId,
                orderId: order.id,
              },
            },
            {
              eventId: `paypal:${payload.id || payload.event_id}:subscription_cancel_involuntary`.slice(0, 80),
              eventName: 'subscription_cancel_involuntary',
              eventCategory: 'retention',
              eventTs: new Date().toISOString(),
              userId: user.id,
              metadata: {
                provider: 'paypal',
                reason: 'payment_sale_denied',
                paypalSubscriptionId: subId,
                orderId: order.id,
              },
            },
          ],
          sessionUserId: user.id,
        });
      } catch (e) {
        log.debug('[PAYPAL_WH] analytics payment_failed/involuntary_cancel skipped', {
          error: e instanceof Error ? e.message : e,
        });
      }

      await cancelSubscription({
        prisma,
        user,
        plan: plan[getPlanKey(PaymentService.PAYPAL)]!,
        service: PaymentService.PAYPAL,
        reason: OrderStatus.FAILED,
      });

      break;
    }
    default:
      log.info(`[PAYPAL_WH] Event type ${payload.event_type} not handled`);
      break;
  }
};
