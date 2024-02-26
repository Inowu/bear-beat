import { z } from 'zod';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import { TRPCError } from '@trpc/server';
import { getFtpUserInfo } from '../../utils/getFtpUserInfo';
import { gbToBytes } from '../../../utils/gbToBytes';
import { updateFtpUserInfo } from './updateSubscription';
import { log } from '../../../server';

export const updatePlanInfo = shieldedProcedure
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

    log.info(
      `[CHANGE_PLAN] Updating plan for user ${user.id} to new plan ${newPlan.id}`,
    );
    await updateFtpUserInfo({
      subscription: subscriptionInfo,
      user,
      subscriptionOrder,
      newPlan,
    });

    return {
      message: 'Plan actualizado exitosamente',
    };
  });
