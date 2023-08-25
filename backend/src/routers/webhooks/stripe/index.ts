import { Plans, PrismaClient, Users } from '@prisma/client';
import { Stripe } from 'stripe';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import { cancelSubscription } from '../../subscriptions/services/cancelSubscription';
import { log } from '../../../server';
import { subscribe } from '../../subscriptions/services/subscribe';
import { getPlanKey } from '../../../utils/getPlanKey';
import { StripeEvents } from './events';
import { OrderStatus } from '../../subscriptions/interfaces/order-status.interface';
import stripeInstance from '../../../stripe';

export const stripeSubscriptionWebhook = shieldedProcedure.mutation(
  async ({ ctx: { req, prisma } }) => {
    const payload: Stripe.Event = JSON.parse(req.body as any);

    const payloadStr = req.body;

    if (!shouldHandleEvent(payload)) return;

    const user = await getCustomerIdFromPayload(payload, prisma);

    if (!user) {
      log.error(
        `[STRIPE_WH] User not found in event: ${payload.type}, payload: ${payloadStr}`,
      );
      return;
    }

    const plan = await getPlanFromPayload(payload, prisma);

    if (!plan && payload.type?.startsWith('customer.subscription')) {
      log.error(
        `[STRIPE_WH] Plan not found in event: ${payload.type}, payload: ${payloadStr}`,
      );

      return;
    }

    const subscription = payload.data.object as any;

    await addMetadataToSubscription({
      subId: subscription.id,
      prisma,
    });

    switch (payload.type) {
      case StripeEvents.SUBSCRIPTION_CREATED: {
        if (subscription.status !== 'active') {
          log.info(
            `[STRIPE_WH] A subscription was created for user ${user.id}, subscription id: ${subscription.id}, status: ${subscription.status}`,
          );

          return;
        }

        subscribe({
          user,
          prisma,
          plan: plan!,
          orderId: subscription.metadata.orderId,
        });

        break;
      }
      case StripeEvents.SUBSCRIPTION_UPDATED:
        switch (subscription.status) {
          case 'active': {
            log.info(
              `[STRIPE_WH] Creating subscription for user ${user.id}, subscription id: ${subscription.id}, payload: ${payloadStr}`,
            );

            await subscribe({
              prisma,
              user,
              plan: plan!,
              orderId: subscription.metadata.orderId,
            });
            break;
          }
          case 'incomplete_expired':
            log.info(
              `[STRIPE_WH] Incomplete subscription was expired for user ${user.id}, subscription id: ${subscription.id}, payload: ${payloadStr}`,
            );
            await prisma.orders.update({
              where: {
                id: subscription.metadata.orderId,
              },
              data: {
                status: OrderStatus.FAILED,
              },
            });
            break;
          case 'past_due':
            log.info(
              `[STRIPE_WH] Subscription renovation failed for user ${user.id}, subscription id: ${subscription.id}, payload: ${payloadStr}`,
            );
            // TODO: What to do when a payment fails?

            await prisma.orders.update({
              where: {
                id: subscription.metadata.orderId,
              },
              data: {
                status: OrderStatus.CANCELLED,
              },
            });
            await cancelSubscription({ prisma, user });
            break;
          default:
            await prisma.orders.update({
              where: {
                id: subscription.metadata.orderId,
              },
              data: {
                status: OrderStatus.FAILED,
              },
            });
            await cancelSubscription({ prisma, user });
            break;
        }
        break;
      case StripeEvents.SUBSCRIPTION_DELETED:
        log.info(
          `[STRIPE_WH] Canceling subscription for user ${user.id}, subscription id: ${subscription.id}, payload: ${payloadStr}`,
        );
        await cancelSubscription({ prisma, user });
        break;
      default:
        log.info(
          `[STRIPE_WH] Unhandled event ${payload.type}, payload: ${payloadStr}`,
        );
    }
  },
);

export const getCustomerIdFromPayload = async (
  payload: Stripe.Event,
  prisma: PrismaClient,
): Promise<Users | null> => {
  let user: Users | null | undefined = null;

  switch (payload.type) {
    case StripeEvents.SUBSCRIPTION_UPDATED:
    case StripeEvents.SUBSCRIPTION_DELETED:
      user = await prisma.users.findFirst({
        where: {
          stripe_cusid: (payload.data.object as any).customer,
        },
      });
      break;
    default:
      break;
  }

  return user;
};

const getPlanFromPayload = async (
  payload: Stripe.Event,
  prisma: PrismaClient,
): Promise<Plans | null> => {
  let plan: Plans | null | undefined = null;

  switch (payload.type) {
    case StripeEvents.SUBSCRIPTION_UPDATED:
    case StripeEvents.SUBSCRIPTION_DELETED:
      plan = await prisma.plans.findFirst({
        where: {
          [getPlanKey('stripe')]: (payload.data.object as any).plan.id,
        },
      });
      break;
    default:
      break;
  }

  return plan;
};

const shouldHandleEvent = (payload: Stripe.Event): boolean => {
  switch (payload.type) {
    case StripeEvents.SUBSCRIPTION_UPDATED:
    case StripeEvents.SUBSCRIPTION_DELETED:
      return true;
    default:
      log.info(
        `[STRIPE_WH] Uhandled event ${payload.type}, payload: ${JSON.stringify(
          payload,
        )}`,
      );
      return false;
  }
};

const addMetadataToSubscription = async ({
  subId,
  prisma,
}: {
  subId: string;
  prisma: PrismaClient;
}) => {
  const subscription = await stripeInstance.subscriptions.retrieve(subId);

  const order = await prisma.orders.findFirst({
    where: {
      txn_id: subId,
    },
  });

  if (!order) {
    log.warn(
      `[STRIPE_WH] No order found with a stripe subscription id of ${subId}`,
    );

    return;
  }

  if (!subscription.metadata.orderId && order) {
    log.info(
      `Adding order id (${order.id}) to subscription ${subscription.id}`,
    );

    await stripeInstance.subscriptions.update(subId, {
      metadata: {
        orderId: order.id,
      },
    });
  }
};
