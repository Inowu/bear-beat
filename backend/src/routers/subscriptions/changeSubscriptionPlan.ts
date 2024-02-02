import { z } from 'zod';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { TRPCError } from '@trpc/server';
import stripeInstance from '../../stripe';
import { PaymentService } from './services/types';
import { log } from '../../server';

export const changeSubscriptionPlan = shieldedProcedure
  .input(
    z.object({
      newPlanId: z.number(),
    }),
  )
  .mutation(async ({ ctx: { prisma, session }, input: { newPlanId } }) => {
    const user = session!.user!;

    const plan = await prisma.plans.findUnique({
      where: {
        id: newPlanId,
      },
    });

    if (!plan) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'El plan no fue encontrado',
      });
    }

    const subscriptionInfo = await prisma.descargasUser.findFirst({
      where: {
        user_id: user.id,
      },
    });

    if (!subscriptionInfo || !subscriptionInfo.order_id) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Este usuario no tiene una suscripción activa',
      });
    }

    const subscriptionOrder = await prisma.orders.findFirst({
      where: {
        id: subscriptionInfo.order_id,
      },
    });

    if (!subscriptionOrder) {
      log.error(`[SUBSCRIPTION] No se encontró la orden de la suscripción`);
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No se encontró la orden de la suscripción',
      });
    }

    if (
      subscriptionOrder.payment_method !== PaymentService.STRIPE &&
      subscriptionOrder.payment_method !== PaymentService.PAYPAL
    ) {
      log.error(
        `[SUBSCRIPTION] No se puede cambiar el plan de una suscripción que no fue pagada con tarjeta de crédito/débito o PayPal, ${subscriptionOrder.id}`,
      );
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'No se puede cambiar el plan de una suscripción que no fue pagada con tarjeta de crédito/débito o PayPal',
      });
    }

    if (!subscriptionOrder.plan_id) {
      log.error(
        `[SUBSCRIPTION] Esta orden no tiene un plan asociado, ${subscriptionOrder.id}`,
      );
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'La orden de la suscripción no tiene un plan asociado',
      });
    }

    const currentPlan = await prisma.plans.findUnique({
      where: {
        id: subscriptionOrder.plan_id,
      },
    });

    if (plan.stripe_prod_id) {
      // Update the stripe subscription
      // const stripeSub = await stripeInstance.subscriptions.retrieve();
    }

    //   await stripeInstance.subscriptionItems.list({
    //   subscription:
    // })
  });
