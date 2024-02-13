import { z } from 'zod';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { TRPCError } from '@trpc/server';
import stripeInstance from '../../stripe';
import { PaymentService } from './services/types';
import { log } from '../../server';
import axios from 'axios';
import { paypal } from '../../paypal';

export const changeSubscriptionPlan = shieldedProcedure
  .input(
    z.object({
      newPlanId: z.number(),
    }),
  )
  .mutation(async ({ ctx: { prisma, session }, input: { newPlanId } }) => {
    const user = session!.user!;

    const newPlan = await prisma.plans.findUnique({
      where: {
        id: newPlanId,
      },
    });

    if (!newPlan) {
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
      log.error(`[CHANGE_PLAN] No se encontró la orden de la suscripción`);
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
        `[CHANGE_PLAN] No se puede cambiar el plan de una suscripción que no fue pagada con tarjeta de crédito/débito o PayPal, ${subscriptionOrder.id}`,
      );
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'No se puede cambiar el plan de una suscripción que no fue pagada con tarjeta de crédito/débito o PayPal',
      });
    }

    if (!subscriptionOrder.plan_id) {
      log.error(
        `[CHANGE_PLAN] Esta orden no tiene un plan asociado, ${subscriptionOrder.id}`,
      );
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'La orden de la suscripción no tiene un plan asociado',
      });
    }

    if (newPlan.stripe_prod_id) {
      // Update the stripe subscription
      const subscriptionId = subscriptionOrder.txn_id;
      if (!subscriptionId || !subscriptionId.startsWith('sub_')) {
        log.error(
          `[CHANGE_PLAN] This subscription's order has no subscription id or the id is invalid, order id: ${subscriptionOrder.id}`,
        );

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            'Hay un problema con esta suscripción, por favor contacta a soporte',
        });
      }

      const stripeSub = (
        await stripeInstance.subscriptionItems.list({
          subscription: subscriptionId,
        })
      ).data[0];

      if (!stripeSub) {
        log.error(
          `[CHANGE_PLAN] Stripe subscription not found, sub id ${subscriptionId}`,
        );

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            'Hay un problema con esta suscripción, por favor contacta a soporte',
        });
      }

      try {
        await stripeInstance.subscriptionItems.update(stripeSub.id, {
          price: newPlan.stripe_prod_id,
        });

        return {
          message: 'El plan de tu suscripción ha sido actualizado',
        };
      } catch (e) {
        log.error(
          `[CHANGE_PLAN] Error updating stripe subscription item, ${e}`,
        );
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            'Hubo un error al actualizar tu plan, por favor contacta a soporte',
        });
      }
    } else if (newPlan.paypal_plan_id) {
      if (
        !subscriptionOrder.txn_id ||
        !subscriptionOrder.txn_id.startsWith('I-')
      ) {
        log.error(
          `[CHANGE_PLAN] This subscription's order has no subscription id or the id is invalid, order id: ${subscriptionOrder.id}`,
        );

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            'Hay un problema con esta suscripción, por favor contacta a soporte',
        });
      }

      const token = await paypal.getToken();

      try {
        // Update the paypal subscription
        await axios.post(
          `${paypal.paypalUrl()}/v1/billing/subscriptions/${
            subscriptionOrder.txn_id
          }/revise`,
          {
            plan_id: newPlan.paypal_plan_id,
          },
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        return {
          message: 'El plan de tu suscripción ha sido actualizado',
        };
      } catch (e) {
        log.error(`[CHANGE_PLAN] Error updating paypal subscription, ${e}`);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            'Hubo un error al actualizar tu plan, por favor contacta a soporte',
        });
      }
    } else {
      log.error(`[CHANGE_PLAN] Plan has no stripe or paypal id, ${newPlan.id}`);

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message:
          'Hubo un error al actualizar tu plan, por favor contacta a soporte',
      });
    }
  });
