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
import { checkIfUserIsFromUH, checkIfUserIsSubscriber, SubscriptionCheckResult } from '../migration/checkUHSubscriber';
import { addDays } from 'date-fns';

export const subscribeWithStripe = shieldedProcedure
  .input(
    z.object({
      planId: z.number(),
      coupon: z.string().optional(),
      fbp: z.string().optional(),
      url: z.string(),
      paymentMethod: z.string().optional(),
    }),
  )
  .query(async ({ input: { planId, coupon, paymentMethod, fbp, url }, ctx: { prisma, session, req } }) => {
    const user = session!.user!;

    const existingUser = await prisma.users.findFirst({
      where: {
        id: user.id,
      },
    })

    const uhUser = await checkIfUserIsFromUH(user.email);
    let migrationUser: SubscriptionCheckResult | null = null;

    if (uhUser) {
      migrationUser = await checkIfUserIsSubscriber(uhUser);
    }

    const stripeCustomer = await getStripeCustomer(prisma, user);

    log.info(`[STRIPE_SUBSCRIBE] User ${user.id} is subscribing to plan ${planId}. Stripe customer: ${stripeCustomer}`)

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

      const trialingSubscription = await stripeInstance.subscriptions.list({
        customer: stripeCustomer,
        status: 'trialing',
      });

      const activeSubscriptions = [
        ...activeSubscription.data,
        ...trialingSubscription.data,
      ];

      if (activeSubscriptions.length > 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Este usuario ya tiene una suscripción activa',
        });
      }

      const trialEnd = migrationUser?.remainingDays ? parseInt((addDays(new Date(), migrationUser.remainingDays).getTime() / 1000).toFixed(0)) : undefined;

      if (migrationUser) {
        log.info(`[STRIPE_SUBSCRIBE:MIGRATION] User ${user.id} has a migration subscription, remaining days: ${migrationUser.remainingDays}. Adding trial to subscription: ${trialEnd}`);
      }

      if (paymentMethod) {
        log.info(`[STRIPE_SUBSCRIBE:MIGRATION] Payment method provided, attaching to customer: ${paymentMethod} - ${stripeCustomer}`);
      try {
        await stripeInstance.paymentMethods.attach(paymentMethod, {
          customer: stripeCustomer,
        })
      } catch(e) {
        log.error(`[STRIPE_SUBSCRIBE:MIGRATION] Error attaching payment method to customer: ${e}`)

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Ocurrió un error al crear el método de pago'
        })
      }

        log.info(`[STRIPE_SUBSCRIBE:MIGRATION] Payment method attached to customer: ${paymentMethod}. Updating customer with default payment method`);
        await stripeInstance.customers.update(stripeCustomer, {
          invoice_settings: {
            default_payment_method: paymentMethod,
          },
        })
      }

      const subscription = await stripeInstance.subscriptions.create(
        {
          customer: stripeCustomer,
          coupon,
          items: [
            {
              plan: plan[getPlanKey(PaymentService.STRIPE)]!,
            },
          ],
          payment_behavior: 'default_incomplete',
          payment_settings: { save_default_payment_method: 'on_subscription' },
          expand: ['latest_invoice.payment_intent'],
          metadata: {
            orderId: String(order.id),
          },
          ...(trialEnd ? { trial_end: trialEnd } : {}),
        },
        { idempotencyKey: `stripe-sub-order-${order.id}` },
      );

      await prisma.orders.update({
        where: {
          id: order.id,
        },
        data: {
          txn_id: subscription.id,
          invoice_id: (subscription?.latest_invoice as any)?.id,
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
            log.info('[STRIPE] Sending Purchase event to Facebook CAPI');
            const value = Number(plan.price);
            const currency = (plan.moneda || 'USD').toUpperCase();
            await facebook.setEvent(
              'Purchase',
              remoteAddress,
              userAgent,
              fbp,
              url,
              existingUser,
              { value, currency },
            );
          }
        }

        await manyChat.addTagToUser(existingUser, 'SUCCESSFUL_PAYMENT');
      }

      return {
        subscriptionId: subscription.id,
        clientSecret: (subscription.latest_invoice as any)?.payment_intent
          ?.client_secret,
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
