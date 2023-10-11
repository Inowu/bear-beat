import { EventResponse } from 'conekta';
import { Plans, Users } from '@prisma/client';
import { subscribe } from '../../subscriptions/services/subscribe';
import { prisma } from '../../../db';
import { log } from '../../../server';
import { cancelSubscription } from '../../subscriptions/services/cancelSubscription';
import { getPlanKey } from '../../../utils/getPlanKey';
import { cancelOrder } from '../../subscriptions/services/cancelOrder';
import { ConektaEvents } from './events';
import { SubscriptionService } from '../../subscriptions/services/types';
import { Request } from 'express';

export const conektaSubscriptionWebhook = async (req: Request) => {
  const payload: EventResponse = JSON.parse(req.body as any);
  const payloadStr = req.body;

  if (!shouldHandleEvent(payload)) return;

  const user = await getCustomerIdFromPayload(payload);

  if (!user) {
    log.error(
      `[CONEKTA_WH] User not found in event: ${payload.type}, payload: ${payloadStr}`,
    );
    return;
  }

  const plan = await getPlanFromPayload(payload);

  if (!plan && payload.type?.startsWith('subscription')) {
    log.error(
      `[CONEKTA_WH] Plan not found in event: ${payload.type}, payload: ${payloadStr}`,
    );

    return;
  }

  const subscription = payload.data?.object;

  switch (payload.type) {
    case ConektaEvents.SUB_PAID:
      log.info(
        `[CONEKTA_WH] Creating subscription for user ${user.id}, subscription id: ${subscription.id}, payload: ${payloadStr}`,
      );
      await subscribe({
        subId: subscription.id,
        prisma,
        user,
        plan: plan!,
        service: SubscriptionService.CONEKTA,
        expirationDate: new Date(),
      });
      break;
    case ConektaEvents.SUB_UPDATED:
      log.info(
        `[CONEKTA_WH] Updating subscription for user ${user.id}, subscription status: ${subscription.status}, subscription id: ${subscription.id}, payload: ${payloadStr}`,
      );
      if (payload.data?.object.status !== 'active') {
        await cancelSubscription({
          prisma,
          user,
          plan: subscription.plan.id,
          service: SubscriptionService.CONEKTA,
        });
      }
      break;
    case ConektaEvents.SUB_CANCELED:
      log.info(
        `[CONEKTA_WH] Canceling subscription for user ${user.id}, subscription id: ${subscription.id}, payload: ${payloadStr}`,
      );
      await cancelSubscription({
        prisma,
        user,
        plan: subscription.plan.id,
        service: SubscriptionService.CONEKTA,
      });
      break;
    case ConektaEvents.ORDER_VOIDED:
    case ConektaEvents.ORDER_DECLINED:
    case ConektaEvents.ORDER_EXPIRED:
    case ConektaEvents.ORDER_CHARGED_BACK:
    case ConektaEvents.ORDER_CANCELED: {
      const orderId = payload.data?.object.metadata.orderId;

      log.info(`[CONEKTA_WH] Canceling order ${orderId}`);
      await cancelOrder({ prisma, orderId });

      break;
    }
    case ConektaEvents.ORDER_PAID:
      // Ignore with card for now
      if (
        payload.data?.object.charges.data[0].payment_method.object.startsWith(
          'card',
        )
      ) {
        log.info(
          `[CONEKTA_WH] Ignoring card payment for user ${user.id}, payload: ${payloadStr}`,
        );
        return;
      }

      log.info(
        `[CONEKTA_WH] Paid order event received for user ${user.id}, payload: ${payloadStr} `,
      );

      await subscribe({
        subId: subscription.id,
        prisma,
        user,
        orderId: payload.data?.object.metadata.orderId,
        service: SubscriptionService.CONEKTA,
        expirationDate: new Date(),
      });
      break;
    default:
      log.info(
        `[CONEKTA_WH] Unhandled event ${payload.type}, payload: ${payloadStr}`,
      );
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
    case ConektaEvents.ORDER_PAID:
      user = await prisma.users.findFirst({
        where: {
          conekta_cusid: payload.data?.object.customer_info.customer_id,
        },
      });
      break;
    default:
      break;
  }

  return user;
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
      return true;
    default:
      log.info(
        `[CONEKTA_WH] Uhandled event ${payload.type}, payload: ${JSON.stringify(
          payload,
        )}`,
      );
      return false;
  }
};
