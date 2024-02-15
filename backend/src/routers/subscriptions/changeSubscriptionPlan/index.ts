import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import { PaymentService } from './../services/types';
import { log } from '../../../server';
import {
  updatePaypalSubscription,
  updateStripeSubscription,
} from './updateSubscription';
import { getFtpUserInfo } from '../../utils/getFtpUserInfo';
import { gbToBytes } from '../../../utils/gbToBytes';

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
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No se encontró la orden de la suscripción',
      });
    }

    const previousPlan = await prisma.plans.findFirst({
      where: {
        id: subscriptionOrder.plan_id!,
      },
    });

    if (!previousPlan) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No se encontró el plan de la suscripción',
      });
    }

    const { tallies } = await getFtpUserInfo(user);

    if (!tallies) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Hubo un error al obtener tu información de FTP',
      });
    }

    // Check if user has used more gb than the plan they are trying to change to
    if (tallies?.bytes_out_used > gbToBytes(Number(newPlan.gigas))) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'No puedes cambiar a un plan con menos gigas de los que has usado',
      });
    }

    if (
      subscriptionOrder.payment_method !== PaymentService.STRIPE &&
      subscriptionOrder.payment_method !== PaymentService.PAYPAL
    ) {
      log.error(
        `[CHANGE_PLAN] Changing plan failed, invalid payment method - ${subscriptionOrder.id}`,
      );
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'No se puede cambiar el plan de una suscripción que no fue pagada con tarjeta de crédito/débito o PayPal',
      });
    }

    if (!subscriptionOrder.plan_id) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'La orden de la suscripción no tiene un plan asociado',
      });
    }

    if (newPlan.stripe_prod_id) {
      return await updateStripeSubscription({
        newPlan,
        subscription: subscriptionInfo,
        subscriptionOrder,
        user,
      });
    } else if (newPlan.paypal_plan_id) {
      return await updatePaypalSubscription({
        newPlan,
        subscriptionOrder,
        user,
        subscription: subscriptionInfo,
      });
    } else {
      log.error(`[CHANGE_PLAN] Plan has no stripe or paypal id, ${newPlan.id}`);

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message:
          'Hubo un error al actualizar tu plan, por favor contacta a soporte',
      });
    }
  });
