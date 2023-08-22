import { EventResponse } from 'conekta';
import { Plans, Users } from '@prisma/client';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { subscribe } from '../subscriptions/services/subscribe';
import { prisma } from '../../db';
import { log } from '../../server';
import { cancelSubscription } from '../subscriptions/services/cancelSubscription';
import { getPlanConektaKey } from '../../utils/getPlanKey';
import { cancelOrder } from '../subscriptions/services/cancelOrder';

export const conektaSubscriptionWebhook = shieldedProcedure.mutation(
  async ({ ctx: { req } }) => {
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
      case 'subscription.paid':
        log.info(
          `[CONEKTA_WH] Creating subscription for user ${user.id}, subscription id: ${subscription.id}, payload: ${payloadStr}`,
        );
        await subscribe({ prisma, user, plan: plan! });
        break;
      case 'subscription.updated':
        log.info(
          `[CONEKTA_WH] Updating subscription for user ${user.id}, subscription status: ${subscription.status}, subscription id: ${subscription.id}, payload: ${payloadStr}`,
        );
        if (payload.data?.object.status !== 'active') {
          await cancelSubscription({ prisma, user });
        }
        break;
      case 'subscription.canceled':
        log.info(
          `[CONEKTA_WH] Canceling subscription for user ${user.id}, subscription id: ${subscription.id}, payload: ${payloadStr}`,
        );
        await cancelSubscription({ prisma, user });
        break;
      case 'order.voided':
      case 'order.declined':
      case 'order.canceled': {
        const orderId = payload.data?.object.metadata.orderId;

        log.info(`[CONEKTA_WH] Canceling order ${orderId}`);
        await cancelOrder({ prisma, orderId });

        break;
      }
      case 'order.paid':
        // Ignore with card for now
        if (
          payload.data?.object.charges.data[0].payment_method.object.startsWith(
            'card',
          )
        ) {
          return;
        }

        log.info(
          `[CONEKTA_WH] Paid order event received for user ${user.id}, payload: ${payloadStr} `,
        );

        await subscribe({
          prisma,
          user,
          orderId: payload.data?.object.metadata.orderId,
        });
        break;
      default:
        log.info(
          `[CONEKTA_WH] Unhandled event ${payload.type}, payload: ${payloadStr}`,
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

const getPlanFromPayload = async (
  payload: EventResponse,
): Promise<Plans | null> => {
  let plan: Plans | null | undefined = null;

  switch (payload.type) {
    case 'subscription.paid':
    case 'subscription.updated':
    case 'subscription.canceled':
      plan = await prisma.plans.findFirst({
        where: {
          [getPlanConektaKey()]: payload.data?.object.plan_id,
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
    case 'subscription.paid':
    case 'subscription.updated':
    case 'subscription.canceled':
    case 'order.voided':
    case 'order.declined':
    case 'order.canceled':
    case 'order.paid':
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
