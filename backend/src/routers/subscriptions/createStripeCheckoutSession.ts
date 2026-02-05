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
import { checkIfUserIsFromUH, checkIfUserIsSubscriber, SubscriptionCheckResult } from '../migration/checkUHSubscriber';
import { addDays } from 'date-fns';

/**
 * Crea una Stripe Checkout Session (redirect a la página de pago de Stripe).
 * El usuario paga en checkout.stripe.com y Stripe redirige a success_url o cancel_url.
 * La suscripción se activa vía webhook customer.subscription.updated (status active).
 */
export const createStripeCheckoutSession = shieldedProcedure
  .input(
    z.object({
      planId: z.number(),
      successUrl: z.string().url(),
      cancelUrl: z.string().url(),
      coupon: z.string().optional(),
    }),
  )
  .mutation(async ({ input: { planId, successUrl, cancelUrl, coupon }, ctx: { prisma, session } }) => {
    const user = session!.user!;

    const stripeCustomer = await getStripeCustomer(prisma, user);

    log.info(`[STRIPE_CHECKOUT_SESSION] User ${user.id} creating checkout session for plan ${planId}`);

    await hasActiveSubscription({
      user,
      customerId: stripeCustomer,
      prisma,
      service: PaymentService.STRIPE,
    });

    const plan = await prisma.plans.findFirst({
      where: { id: planId },
    });

    if (!plan) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Ese plan no existe',
      });
    }

    const priceId = plan[getPlanKey(PaymentService.STRIPE)];
    if (!priceId || typeof priceId !== 'string') {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Este plan no tiene un precio de Stripe configurado',
      });
    }

    let dbCoupon: Cupons | null | undefined;
    if (coupon) {
      dbCoupon = await prisma.cupons.findFirst({
        where: { code: coupon },
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

    let uhUser: SubscriptionCheckResult | null = null;
    const isUhUser = await checkIfUserIsFromUH(user.email);
    if (isUhUser) {
      uhUser = await checkIfUserIsSubscriber(isUhUser);
    }
    const trialEnd = uhUser?.remainingDays
      ? Math.floor(addDays(new Date(), uhUser.remainingDays).getTime() / 1000)
      : undefined;

    if (uhUser) {
      log.info(`[STRIPE_CHECKOUT_SESSION] Migration user ${user.id}, trial_end: ${trialEnd}`);
    }

    try {
      const stripeSession = await stripeInstance.checkout.sessions.create(
        {
          mode: 'subscription',
          customer: stripeCustomer,
          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            orderId: String(order.id),
            userId: String(user.id),
          },
          subscription_data: {
            metadata: {
              orderId: String(order.id),
            },
            ...(trialEnd ? { trial_end: trialEnd } : {}),
          },
          allow_promotion_codes: true,
        },
        { idempotencyKey: `stripe-checkout-order-${order.id}` },
      );

      if (!stripeSession.url) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Stripe no devolvió una URL de checkout',
        });
      }

      log.info(`[STRIPE_CHECKOUT_SESSION] Created session ${stripeSession.id} for order ${order.id}`);

      return {
        url: stripeSession.url,
        sessionId: stripeSession.id,
      };
    } catch (e: unknown) {
      log.error(`[STRIPE_CHECKOUT_SESSION] Error: ${e}`);
      const msg = e instanceof Error ? e.message : 'Error al crear la sesión de pago';
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: msg,
      });
    }
  });
