import { EventResponse } from 'conekta';
import { Plans, Users } from '@prisma/client';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { subscribe } from '../subscriptions/services/subscribe';
import { prisma } from '../../db';
import { log } from '../../server';
import { cancelSubscription } from '../subscriptions/services/cancelSubscription';
import { getPlanConektaKey } from '../../utils/getPlanKey';

export const conektaSubscriptionWebhook = shieldedProcedure.mutation(
  async ({ ctx: { req } }) => {
    const payload: EventResponse = JSON.parse(req.body as any);

    const user = await getCustomerIdFromPayload(payload);

    if (!user) {
      log.error(

        `[CONEKTA_WH] User not found in event: ${payload.type}, payload: ${payload}`,
      );
      return;
    }

    const plan = await getPlanIdFromPayload(payload);

    if (!plan) {
      log.error(
        `[CONEKTA_WH] Plan not found in event: ${payload.type}, payload: ${payload}`,
      );

      return;
    }

    const subscription = payload.data?.object;

    switch (payload.type) {
      case 'subscription.paid':
        log.info(
          `[CONEKTA_WH] Creating subscription for user ${user.id}, subscription id: ${subscription.id}, payload: ${payload}`,
        );
        await subscribe({ prisma, user, plan });
        break;
      case 'subscription.updated':
        log.info(
          `[CONEKTA_WH] Updating subscription for user ${user.id}, subscription status: ${subscription.status}, subscription id: ${subscription.id}, payload: ${payload}`,
        );
        if (payload.data?.object.status !== 'active') {
          await cancelSubscription({ prisma, user });
        }
        break;
      case 'subscription.canceled':
        log.info(
          `[CONEKTA_WH] Canceling subscription for user ${user.id}, subscription id: ${subscription.id}, payload: ${payload}`,
        );
        await cancelSubscription({ prisma, user });
        break;
      // Oxxo payment
      case 'order.paid':
        log.info(
          `[CONEKTA_WH] Paid order event received for user ${user.id}, payload: ${payload} `,
        );
        await subscribe({ prisma, user, plan });
        break;
      default:
        log.info(
          `[CONEKTA_WH] Unhandled event ${payload.type}, payload: ${payload}`,
        );
    }
  },
);

export const getCustomerIdFromPayload = async (
  payload: EventResponse,
): Promise<Users | null> => {
  let user: Users | null | undefined = null;

  switch (payload.type) {
    case 'subscription.paid':
    case 'subscription.updated':
    case 'subscription.canceled':
      user = await prisma.users.findFirst({
        where: {
          conekta_cusid: payload.data?.object.customer_id,
        },
      });
      break;
    case 'order.paid':
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

const getPlanIdFromPayload = async (
  payload: EventResponse,
): Promise<Plans | null> => {
  let plan: Plans | null | undefined = null;

  switch (payload.type) {
    case 'subscription.paid':
    case 'subscription.updated':
    case 'subscription.canceled':
      plan = await prisma.plans.findFirst({
        where: {
          [getPlanConektaKey()]: payload.data?.object.customer_id,
        },
      });
      break;
    case 'order.paid':
      plan = await prisma.plans.findFirst({
        where: {
          [getPlanConektaKey()]: payload.data?.object.customer_info.customer_id,
        },
      });
      break;
    default:
      break;
  }

  return plan;
};
