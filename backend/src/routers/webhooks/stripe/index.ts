import { Plans, PrismaClient, Users } from '@prisma/client';
import { Stripe } from 'stripe';
import { cancelSubscription } from '../../subscriptions/services/cancelSubscription';
import { log } from '../../../server';
import { subscribe } from '../../subscriptions/services/subscribe';
import { getPlanKey } from '../../../utils/getPlanKey';
import { StripeEvents } from './events';
import { OrderStatus } from '../../subscriptions/interfaces/order-status.interface';
import stripeInstance from '../../../stripe';
import { prisma } from '../../../db';
import { Request } from 'express';
import { SubscriptionService } from '../../subscriptions/services/types';

export const stripeSubscriptionWebhook = async (req: Request) => {
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

  // await addMetadataToSubscription({
  //   subId: subscription.id,
  //   prisma,
  //   payload,
  //   user,
  //   plan: plan!,
  // });

  switch (payload.type) {
    case StripeEvents.SUBSCRIPTION_CREATED: {
      if (subscription.status !== 'active') {
        log.info(
          `[STRIPE_WH] A subscription was created for user ${user.id}, subscription id: ${subscription.id}, status: ${subscription.status}`,
        );

        return;
      }

      subscribe({
        subId: subscription.id,
        user,
        prisma,
        plan: plan!,
        orderId: subscription.metadata.orderId,
        service: SubscriptionService.STRIPE,
        expirationDate: new Date(subscription.current_period_end * 1000),
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
            subId: subscription.id,
            prisma,
            user,
            plan: plan!,
            orderId: subscription.metadata.orderId,
            service: SubscriptionService.STRIPE,
            expirationDate: new Date(subscription.current_period_end * 1000),
          });
          break;
        }
        case 'incomplete_expired':
          log.info(
            `[STRIPE_WH] Incomplete subscription was expired for user ${user.id}, subscription id: ${subscription.id}, payload: ${payloadStr}`,
          );

          if (subscription.metadata.orderId) {
            await prisma.orders.update({
              where: {
                id: Number(subscription.metadata.orderId),
              },
              data: {
                status: OrderStatus.FAILED,
              },
            });
          }

          break;
        case 'past_due':
          log.info(
            `[STRIPE_WH] Subscription renovation failed for user ${user.id}, canceling subscription... subscription id: ${subscription.id}, payload: ${payloadStr}`,
          );
          // TODO: What to do when a payment fails?

          if (subscription.metadata.orderId) {
            await prisma.orders.update({
              where: {
                id: Number(subscription.metadata.orderId),
              },
              data: {
                status: OrderStatus.CANCELLED,
              },
            });
          }

          await cancelSubscription({
            prisma,
            user,
            plan: subscription.object.plan,
          });

          break;
        default:
          if (subscription.metadata.orderId) {
            await prisma.orders.update({
              where: {
                id: Number(subscription.metadata.orderId),
              },
              data: {
                status: OrderStatus.FAILED,
              },
            });
          }

          await cancelSubscription({
            prisma,
            user,
            plan: subscription.plan.id,
          });

          break;
      }
      break;
    case StripeEvents.SUBSCRIPTION_DELETED:
      log.info(
        `[STRIPE_WH] Canceling subscription for user ${user.id}, subscription id: ${subscription.id}, payload: ${payloadStr}`,
      );

      await cancelSubscription({ prisma, user, plan: subscription.plan.id });
      break;
    default:
      log.info(
        `[STRIPE_WH] Unhandled event ${payload.type}, payload: ${payloadStr}`,
      );
  }
};

export const getCustomerIdFromPayload = async (
  payload: Stripe.Event,
  prisma: PrismaClient,
): Promise<Users | null> => {
  let user: Users | null | undefined = null;

  const customerId = (payload.data.object as any).customer;

  switch (payload.type) {
    case StripeEvents.SUBSCRIPTION_CREATED:
    case StripeEvents.SUBSCRIPTION_UPDATED:
    case StripeEvents.SUBSCRIPTION_DELETED:
      user = await prisma.users.findFirst({
        where: {
          stripe_cusid: customerId,
        },
      });
      break;
    default:
      break;
  }

  if (!user) {
    try {
      const existingUser = await stripeInstance.customers.retrieve(customerId);

      log.info(
        `[STRIPE_WH] No user with customerId ${customerId} was found, trying to update existing db user ${
          existingUser.id
        }. Customer: ${JSON.stringify(existingUser)}`,
      );

      const dbUser = await prisma.users.findFirst({
        where: {
          email: (existingUser as any).email,
        },
      });

      if (!dbUser) {
        log.error(
          `[STRIPE_WH] No user was found with customer email ${
            (existingUser as any).email
          }`,
        );

        return null;
      }

      await prisma.users.update({
        where: {
          id: dbUser.id,
        },
        data: {
          stripe_cusid: customerId,
        },
      });

      log.info(
        `[STRIPE_WH] Updated user ${dbUser.id} with stripe_cusid ${customerId}`,
      );

      return dbUser;
    } catch (e: any) {
      if (e.type === 'StripeInvalidRequestError') {
        if (e.raw.code === 'resource_missing') {
          log.error(
            `[STRIPE_WH] Could not find customer with id ${customerId}`,
          );
        } else {
          log.error(
            `[STRIPE_WH] Stripe error when retrieving customer ${customerId}: ${e.raw.message}`,
          );
        }
      } else {
        log.error(
          `[STRIPE_WH] An error happened when trying to update user with customer id ${customerId}: ${e.message}`,
        );
      }

      return customerId;
    }
  }

  return user;
};

const getPlanFromPayload = async (
  payload: Stripe.Event,
  prisma: PrismaClient,
): Promise<Plans | null> => {
  let plan: Plans | null | undefined = null;

  switch (payload.type) {
    case StripeEvents.SUBSCRIPTION_CREATED:
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
    case StripeEvents.SUBSCRIPTION_CREATED:
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

// const addMetadataToSubscription = async ({
//   subId,
//   prisma,
//   payload,
//   plan,
//   user,
// }: {
//   subId: string;
//   prisma: PrismaClient;
//   payload: Stripe.Event;
//   plan: Plans;
//   user: Users;
// }) => {
//   const subscription = await stripeInstance.subscriptions.retrieve(subId);
//
//   let order = await prisma.orders.findFirst({
//     where: {
//       txn_id: subId,
//     },
//   });
//
//   if (!order) {
//     log.warn(
//       `[STRIPE_WH] No order found with a stripe subscription id of ${subId}, creating one...`,
//     );
//
//     order = await prisma.orders.create({
//       data: {
//         txn_id: subId,
//         user_id: user.id,
//         status: OrderStatus.PENDING,
//         is_plan: 1,
//         plan_id: plan.id,
//         payment_method: 'Stripe Renovación',
//         date_order: new Date().toISOString(),
//         total_price: Number(plan.price),
//       },
//     });
//   }
//
//   if (subscription.id && !subscription.metadata.orderId && order) {
//     log.info(
//       `Adding order id (${order.id}) to subscription ${subscription.id}`,
//     );
//
//     try {
//       await stripeInstance.subscriptions.update(subId, {
//         metadata: {
//           orderId: order.id,
//         },
//       });
//     } catch (e) {
//       log.error(
//         `[STRIPE_WH] Error while updating subscription ${subId}, payload ${JSON.stringify(
//           payload,
//         )}`,
//       );
//     }
//   }
// };
