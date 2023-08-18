import { EventResponse } from 'conekta';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { subscribe } from '../subscriptions/services/subscribe';
import { prisma } from '../../db';
import { log } from '../../server';
import { cancelSubscription } from '../subscriptions/services/cancelSubscription';

export const conektaSubscriptionWebhook = shieldedProcedure.mutation(
  async ({ ctx: { req } }) => {
    const payload: EventResponse = JSON.parse(req.body as any);

    const user = await prisma.users.findFirst({
      where: {
        conekta_cusid: payload.data?.object.customer_id,
      },
    });

    if (!user) return;

    const plan = await prisma.plans.findFirst({
      where: {
        [process.env.NODE_ENV === 'production'
          ? 'conekta_prod_id'
          : 'conekta_test_id']: payload.data?.object.plan_id,
      },
    });

    if (!plan) return;

    const subscription = payload.data?.object;

    switch (payload.type) {
      case 'subscription.paid':
        log.info(
          `Creating subscription for user ${user.id}, subscription id: ${subscription.id}`,
        );
        await subscribe({ prisma, user, plan });
        break;
      case 'subscription.updated':
        log.info(
          `Updating subscription for user ${user.id}, subscription status: ${subscription.status}, subscription id: ${subscription.id}`,
        );
        if (payload.data?.object.status !== 'active') {
          await cancelSubscription({ prisma, user });
        }
        break;
      case 'subscription.canceled':
        log.info(
          `Canceling subscription for user ${user.id}, subscription id: ${subscription.id}`,
        );
        await cancelSubscription({ prisma, user });
        break;
      default:
    }
  },
);
