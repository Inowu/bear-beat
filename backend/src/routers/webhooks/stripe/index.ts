import { Plans, Users } from '@prisma/client';
import { Stripe } from 'stripe';
import { Request } from 'express';
import { cancelSubscription } from '../../subscriptions/services/cancelSubscription';
import { log } from '../../../server';
import { subscribe } from '../../subscriptions/services/subscribe';
import { getPlanKey } from '../../../utils/getPlanKey';
import { StripeEvents } from './events';
import stripeInstance from '../../../stripe';
import { prisma } from '../../../db';
import { PaymentService } from '../../subscriptions/services/types';
import { OrderStatus } from '../../subscriptions/interfaces/order-status.interface';
import { brevo } from '../../../email';
import { manyChat } from '../../../many-chat';
import { TRPCError } from '@trpc/server';
import { checkIfUserIsFromUH, checkIfUserIsSubscriber, SubscriptionCheckResult } from '../../migration/checkUHSubscriber';
import uhStripeInstance from '../../migration/uhStripe';
import { uhConektaSubscriptions } from '../../migration/uhConekta';
import { paypal as uhPaypal } from '../../migration/uhPaypal';
import axios, { AxiosError } from 'axios';

export const stripeSubscriptionWebhook = async (req: Request) => {
  const payload: Stripe.Event = JSON.parse(req.body as any);

  const payloadStr = req.body;

  if (!shouldHandleEvent(payload)) return;

  const user = await getUserFromPayload(payload);

  if (!user) {
    log.error(
      `[STRIPE_WH] User not found in event: ${payload.type}, payload: ${payloadStr}`,
    );
    return;
  }

  const plan = (await getPlanFromPayload(payload))!;

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
      if (subscription.status === 'trialing') {
        log.info(`[STRIPE_WH] A trial subscription was created for user ${user.id}, subscription id: ${subscription.id}, status: ${subscription.status}`);
        await subscribe({
          subId: subscription.id,
          prisma,
          user,
          plan: plan!,
          orderId: subscription.metadata.orderId,
          service: PaymentService.STRIPE,
          expirationDate: new Date(subscription.current_period_end * 1000),
        });
        await cancelUhSubscription(user);
      }

      if (subscription.status !== 'active' && subscription.status !== 'trialing') {
        log.info(
          `[STRIPE_WH] A subscription was created for user ${user.id}, subscription id: ${subscription.id}, status: ${subscription.status}`,
        );

        return;
      }

      try {
        await manyChat.addTagToUser(user, 'SUCCESSFUL_PAYMENT');
      } catch (e) {
        log.error(`[STRIPE] Error while adding tag to user ${user.id}: ${e}`);
      }

      // subscribe({
      //   subId: subscription.id,
      //   user,
      //   prisma,
      //   plan: plan!,
      //   orderId: subscription.metadata.orderId,
      //   service: PaymentService.STRIPE,
      //   expirationDate: new Date(subscription.current_period_end * 1000),
      // });

      break;
    }
    case StripeEvents.SUBSCRIPTION_UPDATED:
      switch (subscription.status) {
        case 'active': {
          log.info(
            `[STRIPE_WH] Creating subscription for user ${user.id}, subscription id: ${subscription.id}, payload: ${payloadStr}`,
          );

          try {
            await brevo.smtp.sendTransacEmail({
              templateId: 2,
              to: [{ email: user.email, name: user.username }],
              params: {
                NAME: user.username,
                plan_name: plan.name,
                price: plan.price,
                currency: plan.moneda.toUpperCase(),
                ORDER: subscription.metadata.orderId,
              },
            });
          } catch (e) {
            log.error(`[STRIPE] Error while sending email ${e}`);
          }

          try {
            await manyChat.addTagToUser(user, 'SUCCESSFUL_PAYMENT');
          } catch (e) {
            log.error(
              `[STRIPE] Error while adding tag to user ${user.id}: ${e}`,
            );
          }

          await subscribe({
            subId: subscription.id,
            prisma,
            user,
            plan: plan!,
            orderId: subscription.metadata.orderId,
            service: PaymentService.STRIPE,
            expirationDate: new Date(subscription.current_period_end * 1000),
          });

          await cancelUhSubscription(user);
          break;
        }
        case 'incomplete_expired': {
          log.info(
            `[STRIPE_WH] Incomplete subscription was expired for user ${user.id}, subscription id: ${subscription.id}, payload: ${payloadStr}`,
          );

          const pendingOrder = await prisma.orders.findFirst({
            where: {
              AND: [
                {
                  status: OrderStatus.PENDING,
                },
                {
                  payment_method: PaymentService.STRIPE,
                },
              ],
            },
          });

          if (pendingOrder) {
            await prisma.orders.update({
              where: {
                id: pendingOrder.id,
              },
              data: {
                status: OrderStatus.EXPIRED,
              },
            });
          }

          break;
        }
        case 'past_due': {
          log.info(
            `[STRIPE_WH] Subscription renovation failed for user ${user.id}, canceling subscription... subscription id: ${subscription.id}, payload: ${payloadStr}`,
          );
          // TODO: What to do when a payment fails?

          await cancelSubscription({
            prisma,
            user,
            plan: subscription.object.plan,
            service: PaymentService.STRIPE,
            reason: OrderStatus.EXPIRED,
          });

          break;
        }
        default:
          await cancelSubscription({
            prisma,
            user,
            plan: subscription.plan.id,
            service: PaymentService.STRIPE,
          });

          break;
      }
      break;
    case StripeEvents.SUBSCRIPTION_DELETED:
      log.info(
        `[STRIPE_WH] Canceling subscription for user ${user.id}, subscription id: ${subscription.id}, payload: ${payloadStr}`,
      );

      await cancelSubscription({
        prisma,
        user,
        plan: subscription.plan.id,
        service: PaymentService.STRIPE,
      });
      break;
    default:
      log.info(
        `[STRIPE_WH] Unhandled event ${payload.type}, payload: ${payloadStr}`,
      );
  }
};

export const getUserFromPayload = async (
  payload: Stripe.Event,
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
        `[STRIPE_WH] No user with customerId ${customerId} was found, trying to update existing db user ${existingUser.id
        }. Customer: ${JSON.stringify(existingUser)}`,
      );

      const dbUser = await prisma.users.findFirst({
        where: {
          email: (existingUser as any).email,
        },
      });

      if (!dbUser) {
        log.error(
          `[STRIPE_WH] No user was found with customer email ${(existingUser as any).email
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
): Promise<Plans | null> => {
  let plan: Plans | null | undefined = null;

  switch (payload.type) {
    case StripeEvents.SUBSCRIPTION_CREATED:
    case StripeEvents.SUBSCRIPTION_UPDATED:
    case StripeEvents.SUBSCRIPTION_DELETED:
      plan = await prisma.plans.findFirst({
        where: {
          [getPlanKey(PaymentService.STRIPE)]: (payload.data.object as any).plan
            .id,
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


const cancelUhSubscription = async (user: Users) => {
  try {
    if (process.env.UH_MIGRATION_ACTIVE === 'true') {
      const uhUser = await checkIfUserIsFromUH(user.email);

      if (uhUser) {
        const migrationUser = await checkIfUserIsSubscriber(uhUser);

        if (migrationUser) {
          log.info(`[STRIPE_WH:MIGRATION] Starting cancellation for ${migrationUser.service} subscription ${migrationUser.subscriptionId}`);

          switch (migrationUser.service) {
            case 'stripe':
              await handleStripeMigration(migrationUser, user.email);
              break;
            case 'conekta':
              await handleConektaMigration(migrationUser, user.email);
              break;
            case 'paypal':
              await handlePaypalMigration(migrationUser, user.email);
              break;
            default:
              throw new Error(`Unknown service: ${migrationUser.service}`);
          }
        }
      }
    }
  } catch (e) {
    log.error(`[STRIPE_WH:MIGRATION] Failed to process migration: ${e}`);

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Error al procesar la migración de suscripción',
    });
  }
};

async function handleStripeMigration(migrationUser: SubscriptionCheckResult, userEmail: string) {
  const customer = await uhStripeInstance.customers.list({
    email: userEmail,
    limit: 1,
  });

  if (customer.data.length === 0) {
    log.error(`[STRIPE_WH:MIGRATION] No customer found for user ${userEmail}`);
    throw new TRPCError({
      code: 'NOT_FOUND',
      message: 'No se encontró el cliente',
    });
  }

  const activeStripeSubscriptions = await uhStripeInstance.subscriptions.list({
    customer: customer.data[0].id,
    status: 'active',
  });

  for (const subscription of activeStripeSubscriptions.data) {
    try {
      log.info(`[STRIPE_WH:MIGRATION] Cancelling active stripe subscription ${subscription.id} for user ${userEmail}`);
      await uhStripeInstance.subscriptions.cancel(subscription.id);
      log.info(`[STRIPE_WH:MIGRATION] Successfully cancelled stripe subscription ${subscription.id} for user ${userEmail}`);
    } catch (e) {
      log.error(`[STRIPE_WH:MIGRATION] Failed to cancel stripe subscription ${subscription.id} for user ${userEmail}: ${e}`);
      throw e;
    }
  }
}

async function handleConektaMigration(migrationUser: SubscriptionCheckResult, userEmail: string) {
  const activeConektaSubscriptions = await uhConektaSubscriptions.getSubscription(migrationUser.subscriptionId);

  if (activeConektaSubscriptions.data.status === 'active') {
    try {
      log.info(`[STRIPE_WH:MIGRATION] Cancelling active conekta subscription ${migrationUser.subscriptionId} for user ${userEmail}`);
      await uhConektaSubscriptions.cancelSubscription(migrationUser.subscriptionId);
      log.info(`[STRIPE_WH:MIGRATION] Successfully cancelled conekta subscription ${migrationUser.subscriptionId} for user ${userEmail}`);
    } catch (e) {
      log.error(`[STRIPE_WH:MIGRATION] Failed to cancel conekta subscription ${migrationUser.subscriptionId} for user ${userEmail}: ${e}`);
      throw e;
    }
  }
}

async function handlePaypalMigration(migrationUser: SubscriptionCheckResult, userEmail: string) {
  const subscription = (await axios(`${uhPaypal.paypalUrl()}/v1/billing/subscriptions/${migrationUser.subscriptionId}`, {
    headers: {
      Authorization: `Bearer ${await uhPaypal.getToken()}`,
    },
  })).data;

  if (subscription.status === 'ACTIVE') {
    log.info(`[STRIPE_WH:MIGRATION] Cancelling active paypal subscription ${migrationUser.subscriptionId} for user ${userEmail}`);

    try {
      await axios.post(`${uhPaypal.paypalUrl()}/v1/billing/subscriptions/${migrationUser.subscriptionId}/cancel`, {
        reason: 'CANCEL_BY_USER',
      }, {
        headers: {
          Authorization: `Bearer ${await uhPaypal.getToken()}`,
        }
      });

      log.info(`[STRIPE_WH:MIGRATION] Active paypal subscription cancelled for user ${userEmail}`);
    } catch (e) {
      log.error(`[STRIPE_WH:MIGRATION] An error happened while cancelling active paypal subscription for user ${userEmail}: ${(e as AxiosError).response?.data}`);

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Ocurrió un error al migrar la suscripción',
      });
    }
  }
}