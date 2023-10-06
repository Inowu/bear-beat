import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { log } from '../../server';
import { OrderStatus } from './interfaces/order-status.interface';
import { SubscriptionService } from './services/types';

export const subscribeWithPaypal = shieldedProcedure
  .input(
    z.object({
      planId: z.number(),
      subscriptionId: z.string(),
    }),
  )
  .query(
    async ({ input: { planId, subscriptionId }, ctx: { prisma, session } }) => {
      const user = session!.user!;

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

      try {
        const order = await prisma.orders.findFirst({
          where: {
            txn_id: subscriptionId,
          },
        });

        if (!order) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Es necesario crear una orden de paypal primero',
          });
        }

        await prisma.orders.update({
          where: {
            id: order.id,
          },
          data: {
            status: OrderStatus.PAID,
          },
        });

        return {
          message: 'La suscripción se creó correctamente',
        };
      } catch (e) {
        log.error(
          `[PAYPAL] An error happened while creating subscription with paypal ${e}`,
        );

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Ocurrion un error al crear la suscripción',
        });
      }
    },
  );
