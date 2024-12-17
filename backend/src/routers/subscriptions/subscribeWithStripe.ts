import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { getStripeCustomer } from './utils/getStripeCustomer';
import { getPlanKey } from '../../utils/getPlanKey';
import stripeInstance from '../../stripe';
import { log } from '../../server';
import { OrderStatus } from './interfaces/order-status.interface';
import { hasActiveSubscription } from './utils/hasActiveSub';
import { PaymentService } from './services/types';
import { Cupons } from '@prisma/client';
import { facebook } from '../../facebook';
import { manyChat } from '../../many-chat';
import { paypal as uhPaypal } from '../migration/uhPaypal';
import { checkIfUserIsFromUH, checkIfUserIsSubscriber, SubscriptionCheckResult } from '../migration/checkUHSubscriber';
import uhStripeInstance from '../migration/uhStripe';
import { uhConektaSubscriptions } from '../migration/uhConekta';
import axios, { AxiosError } from 'axios';

export const subscribeWithStripe = shieldedProcedure
  .input(
    z.object({
      planId: z.number(),
      coupon: z.string().optional(),
      fbp: z.string().optional(),
      url: z.string()
    }),
  )
  .query(async ({ input: { planId, coupon, fbp, url }, ctx: { prisma, session, req } }) => {
    const user = session!.user!;
    let migrationUser: SubscriptionCheckResult | null = null;

    try {
      if (process.env.UH_MIGRATION_ACTIVE === 'true') {
        const uhUser = await checkIfUserIsFromUH(user.email);

        if (uhUser) {
          migrationUser = await checkIfUserIsSubscriber(uhUser);

          if (migrationUser) {
            log.info(`[MIGRATION] Starting cancellation for ${migrationUser.service} subscription ${migrationUser.subscriptionId}`);

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
      log.error(`[MIGRATION] Failed to process migration: ${e}`);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Error al procesar la migración de suscripción',
      });
    }

    const existingUser = await prisma.users.findFirst({
      where: {
        id: user.id,
      },
    })

    const stripeCustomer = await getStripeCustomer(prisma, user);

    await hasActiveSubscription({
      user,
      customerId: stripeCustomer,
      prisma,
      service: PaymentService.STRIPE,
    });

    const plan = await prisma.plans.findFirst({
      where: {
        id: planId,
      },
    });

    if (!plan) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Ese plan no existe',
      });
    }

    let dbCoupon: Cupons | null | undefined;

    if (coupon) {
      dbCoupon = await prisma.cupons.findFirst({
        where: {
          code: coupon,
        },
      });

      if (!dbCoupon) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Ese cupón no existe',
        });
      }

      const usedCoupon = await prisma.cuponsUsed.findFirst({
        where: {
          AND: [{ user_id: user.id }, { cupon_id: dbCoupon.id }],
        },
      });

      if (usedCoupon) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ese cupón ya fue usado',
        });
      }
    }

    const order = await prisma.orders.create({
      data: {
        user_id: user.id,
        status: OrderStatus.PENDING,
        is_plan: 1,
        plan_id: plan.id,
        payment_method: PaymentService.STRIPE,
        date_order: new Date().toISOString(),
        total_price: Number(plan.price),
        ...(dbCoupon ? { discount: dbCoupon.discount } : {}),
      },
    });

    try {
      const activeSubscription = await stripeInstance.subscriptions.list({
        customer: stripeCustomer,
        status: 'active',
      });

      if (activeSubscription.data.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Este usuario ya tiene una suscripción activa',
        });
      }

      const subscription = await stripeInstance.subscriptions.create({
        customer: stripeCustomer,
        coupon,
        items: [
          {
            plan: plan[getPlanKey(PaymentService.STRIPE)]!,
          },
        ],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        trial_period_days: migrationUser?.remainingDays,
        // proration_behavior: 'always_invoice',
        expand: ['latest_invoice.payment_intent'],
        metadata: {
          orderId: order.id,
        },
      });

      await prisma.orders.update({
        where: {
          id: order.id,
        },
        data: {
          txn_id: subscription.id,
          invoice_id: (subscription.latest_invoice as any).id,
        },
      });

      if (coupon) {
        const dbCoupon = await prisma.cupons.findFirst({
          where: {
            code: coupon,
          },
        });

        if (!dbCoupon) {
          log.warn(`[STRIPE] Coupon ${coupon} not found in database`);
        } else {
          log.info(`[STRIPE] Coupon used: ${coupon} by user ${user.id}`);

          await prisma.cuponsUsed.create({
            data: {
              user_id: user.id,
              cupon_id: dbCoupon.id,
              date_cupon: new Date(),
            },
          });
        }
      }

      if (existingUser) {
        const remoteAddress = req.socket.remoteAddress;
        const userAgent = req.headers['user-agent'];

        if (fbp) {
          if (remoteAddress && userAgent) {
            log.info('[STRIPE] User has successfully paid for a plan, sending event to facebook');
            await facebook.setEvent('PagoExitosoAPI', remoteAddress, userAgent, fbp, url, existingUser);
          }
        }

        await manyChat.addTagToUser(existingUser, 'SUCCESSFUL_PAYMENT');
      }

      return {
        subscriptionId: subscription.id,
        clientSecret: (subscription.latest_invoice as any).payment_intent
          .client_secret,
      };
    } catch (e) {
      log.error(
        `[STRIPE] An error happened while creating subscription with stripe ${e}`,
      );

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Ocurrió un error al crear la suscripción',
      });
    }
  });

async function handleStripeMigration(migrationUser: SubscriptionCheckResult, userEmail: string) {
  const activeStripeSubscriptions = await uhStripeInstance.subscriptions.list({
    customer: migrationUser.subscriptionId,
    status: 'active',
  });

  for (const subscription of activeStripeSubscriptions.data) {
    try {
      log.info(`[MIGRATION] Cancelling active stripe subscription ${subscription.id} for user ${userEmail}`);
      await uhStripeInstance.subscriptions.cancel(subscription.id);
      log.info(`[MIGRATION] Successfully cancelled stripe subscription ${subscription.id} for user ${userEmail}`);
    } catch (e) {
      log.error(`[MIGRATION] Failed to cancel stripe subscription ${subscription.id} for user ${userEmail}: ${e}`);
      throw e;
    }
  }
}

async function handleConektaMigration(migrationUser: SubscriptionCheckResult, userEmail: string) {
  const activeConektaSubscriptions = await uhConektaSubscriptions.getSubscription(migrationUser.subscriptionId);

  if (activeConektaSubscriptions.data.status === 'active') {
    try {
      log.info(`[MIGRATION] Cancelling active conekta subscription ${migrationUser.subscriptionId} for user ${userEmail}`);
      await uhConektaSubscriptions.cancelSubscription(migrationUser.subscriptionId);
      log.info(`[MIGRATION] Successfully cancelled conekta subscription ${migrationUser.subscriptionId} for user ${userEmail}`);
    } catch (e) {
      log.error(`[MIGRATION] Failed to cancel conekta subscription ${migrationUser.subscriptionId} for user ${userEmail}: ${e}`);
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
    log.info(`[MIGRATION] Cancelling active paypal subscription ${migrationUser.subscriptionId} for user ${userEmail}`);

    try {
      await axios.post(`${uhPaypal.paypalUrl()}/v1/billing/subscriptions/${migrationUser.subscriptionId}/cancel`, {
        reason: 'CANCEL_BY_USER',
      }, {
        headers: {
          Authorization: `Bearer ${await uhPaypal.getToken()}`,
        }
      });

      log.info(`[MIGRATION] Active paypal subscription cancelled for user ${userEmail}`);
    } catch (e) {
      log.error(`[MIGRATION] An error happened while cancelling active paypal subscription for user ${userEmail}: ${(e as AxiosError).response?.data}`);

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Ocurrió un error al migrar la suscripción',
      });
    }
  }
}
