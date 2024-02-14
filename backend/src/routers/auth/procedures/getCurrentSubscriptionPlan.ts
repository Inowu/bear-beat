import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';

export const getCurrentSubscriptionPlan = shieldedProcedure.query(
  async ({ ctx: { session, prisma } }) => {
    const user = session!.user!;

    const sub = await prisma.descargasUser.findFirst({
      where: {
        user_id: user.id,
      },
    });

    if (!sub || !sub.order_id) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'El usuario no tiene un plan activo',
      });
    }

    const order = await prisma.orders.findFirst({
      where: {
        id: sub?.order_id,
      },
    });

    if (!order || !order.plan_id) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No se encontro la orden o el plan asociado a la orden',
      });
    }

    const plan = await prisma.plans.findFirst({
      where: {
        id: order.plan_id,
      },
    });

    if (!plan) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'No se encontro el plan',
      });
    }

    return plan;
  },
);
