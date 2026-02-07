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
import { getClientIpFromRequest } from '../../analytics';

export const subscribeWithStripe = shieldedProcedure
  .input(
    z.object({
      planId: z.number(),
      coupon: z.string().optional(),
      fbp: z.string().optional(),
      fbc: z.string().optional(),
      eventId: z.string().optional(),
      url: z.string(),
      paymentMethod: z.string().optional(),
    }),
  )
  .query(async ({ input: { planId, coupon, paymentMethod, fbp, fbc, eventId, url }, ctx: { prisma, session, req } }) => {
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
        date_order: new Date(),
        total_price: Number(plan.price),
        ...(dbCoupon ? { discount: dbCoupon.discount } : {}),
      },
    });

    const isNoSuchCustomerError = (err: unknown) => {
      const msg = typeof (err as any)?.message === 'string' ? (err as any).message : '';
      return msg.toLowerCase().includes('no such customer');
    };

    const runStripeSubscribe = async (customerId: string) => {
      const activeSubscription = await stripeInstance.subscriptions.list({
        customer: customerId,
        status: 'active',
      });

      const trialingSubscription = await stripeInstance.subscriptions.list({
        customer: customerId,
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
        log.info(`[STRIPE_SUBSCRIBE:MIGRATION] Payment method provided, attaching to customer: ${paymentMethod} - ${customerId}`);
        try {
          await stripeInstance.paymentMethods.attach(paymentMethod, {
            customer: customerId,
          });
        } catch (e) {
          log.error(`[STRIPE_SUBSCRIBE:MIGRATION] Error attaching payment method to customer: ${e}`);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Ocurrió un error al crear el método de pago',
          });
        }
        log.info(`[STRIPE_SUBSCRIBE:MIGRATION] Payment method attached to customer: ${paymentMethod}. Updating customer with default payment method`);
        await stripeInstance.customers.update(customerId, {
          invoice_settings: {
            default_payment_method: paymentMethod,
          },
        });
      }

      const subscription = await stripeInstance.subscriptions.create(
        {
          customer: customerId,
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
        where: { id: order.id },
        data: {
          txn_id: subscription.id,
          invoice_id: (subscription?.latest_invoice as any)?.id,
        },
      });

      if (coupon) {
        const dbCouponForUse = await prisma.cupons.findFirst({
          where: { code: coupon },
        });
        if (!dbCouponForUse) {
          log.warn(`[STRIPE] Coupon ${coupon} not found in database`);
        } else {
          log.info(`[STRIPE] Coupon used: ${coupon} by user ${user.id}`);
          await prisma.cuponsUsed.create({
            data: {
              user_id: user.id,
              cupon_id: dbCouponForUse.id,
              date_cupon: new Date(),
            },
          });
        }
      }

      if (existingUser) {
        const clientIp = getClientIpFromRequest(req);
        const userAgentRaw = req.headers['user-agent'];
        const userAgent =
          typeof userAgentRaw === 'string'
            ? userAgentRaw
            : Array.isArray(userAgentRaw)
              ? userAgentRaw[0] ?? null
              : null;

        try {
          log.info('[STRIPE] Sending Purchase event to Facebook CAPI');
          const value = Number(plan.price);
          const currency = (plan.moneda || 'USD').toUpperCase();
          await facebook.setEvent(
            'Purchase',
            clientIp,
            userAgent,
            { fbp, fbc, eventId },
            url,
            existingUser,
            { value, currency },
          );
        } catch (error) {
          log.error('[STRIPE] Error sending CAPI event', {
            error: error instanceof Error ? error.message : error,
          });
        }
        await manyChat.addTagToUser(existingUser, 'SUCCESSFUL_PAYMENT');
      }

      return {
        subscriptionId: subscription.id,
        clientSecret: (subscription.latest_invoice as any)?.payment_intent?.client_secret,
      };
    };

    try {
      return await runStripeSubscribe(stripeCustomer);
    } catch (e) {
      if (isNoSuchCustomerError(e)) {
        log.warn(`[STRIPE] No such customer detected, clearing stripe_cusid for user ${user.id} and retrying`);
        await prisma.users.update({
          where: { id: user.id },
          data: { stripe_cusid: null },
        });
        const stripeCustomerRetry = await getStripeCustomer(prisma, user);
        try {
          return await runStripeSubscribe(stripeCustomerRetry);
        } catch (retryErr) {
          log.error(`[STRIPE] Retry failed: ${retryErr}`);
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Ocurrió un error al crear la suscripción',
          });
        }
      }
      log.error(`[STRIPE] Error creating subscription: ${e}`);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Ocurrió un error al crear la suscripción',
      });
    }
  });
