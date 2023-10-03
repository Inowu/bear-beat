import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { getStripeCustomer } from './utils/getStripeCustmomer';
import { getPlanKey } from '../../utils/getPlanKey';
import stripeInstance from '../../stripe';
import { log } from '../../server';
import { OrderStatus } from './interfaces/order-status.interface';
import { hasActiveSubscription } from './utils/hasActiveSub';
import { SubscriptionService } from './services/types';

export const subscribeWithStripe = shieldedProcedure
  .input(
    z.object({
      planId: z.number(),
      coupon: z.string().optional(),
    }),
  )
  .query(async ({ input: { planId, coupon }, ctx: { prisma, session } }) => {
    const user = session!.user!;

    const stripeCustomer = await getStripeCustomer(prisma, user);

    await hasActiveSubscription({
      user,
      customerId: stripeCustomer,
      prisma,
      service: SubscriptionService.STRIPE,
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

    if (coupon) {
      const dbCoupon = await prisma.cupons.findFirst({
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
    }

    const order = await prisma.orders.create({
      data: {
        user_id: user.id,
        status: OrderStatus.PENDING,
        is_plan: 1,
        plan_id: plan.id,
        payment_method: 'Stripe',
        date_order: new Date().toISOString(),
        total_price: Number(plan.price),
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
            plan: plan[getPlanKey('stripe')]!,
          },
        ],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
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
        message: 'Ocurrion un error al crear la suscripción',
      });
    }
  });
