import { z } from 'zod';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import { TRPCError } from '@trpc/server';
import { subscribe } from '../../subscriptions/services/subscribe';
import { log } from '../../../server';
import { OrderStatus } from '../../subscriptions/interfaces/order-status.interface';

export const activatePlanForUser = shieldedProcedure
  .input(
    z.object({
      userId: z.number(),
      planId: z.number(),
    }),
  )
  .mutation(async ({ input: { userId, planId }, ctx: { prisma } }) => {
    const plan = await prisma.plans.findFirst({
      where: {
        id: planId,
      },
    });

    if (!plan) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Plan not found',
      });
    }

    const user = await prisma.users.findFirst({
      where: {
        id: userId,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'User not found',
      });
    }

    log.info(`[ADMIN] Activating plan ${plan.name} for user ${user.email}`);

    await prisma.orders.create({
      data: {
        user_id: user.id,
        status: OrderStatus.PAID,
        is_plan: 1,
        plan_id: plan.id,
        payment_method: 'Admin Create Order',
        txn_id: 'ADMIN',
        date_order: new Date().toISOString(),
        total_price: Number(plan.price),
      },
    });

    await subscribe({
      user,
      plan,
      prisma,
    });

    return { message: 'El plan ha sido activado correctamente' };
  });
