import { z } from 'zod';
import { addDays } from 'date-fns';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { getConektaCustomer } from './utils/getConektaCustomer';
import { conektaOrders } from '../../conekta';
import { OrderStatus } from './interfaces/order-status.interface';
import { log } from '../../server';
import { hasActiveSubscription } from './utils/hasActiveSub';

export const subscribeWithCashConekta = shieldedProcedure
  .input(
    z
      .object({
        planId: z.number(),
        paymentMethod: z.union([z.literal('cash'), z.literal('spei')]),
      })
      .strict(),
  )
  .mutation(
    async ({ input: { planId, paymentMethod }, ctx: { prisma, session } }) => {
      const userConektaId = await getConektaCustomer({
        prisma,
        user: session?.user,
      });

      const user = session!.user!;

      await hasActiveSubscription(user, prisma);

      const plan = await prisma.plans.findFirstOrThrow({
        where: {
          id: planId,
        },
      });

      const existingOrder = await prisma.orders.findFirst({
        where: {
          AND: [
            {
              user_id: user.id,
            },
            {
              status: OrderStatus.PENDING,
            },
            {
              payment_method: paymentMethod,
            },
          ],
        },
      });

      if (existingOrder) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'There is already an existing order for this user',
        });
      }

      const order = await prisma.orders.create({
        data: {
          payment_method: paymentMethod,
          user_id: session!.user!.id,
          status: OrderStatus.PENDING,
          date_order: new Date().toISOString(),
          total_price: Number(plan.price),
          plan_id: plan.id,
        },
      });

      try {
        const conektaOrder = await conektaOrders.createOrder({
          currency: plan.moneda.toUpperCase(),
          customer_info: {
            customer_id: userConektaId,
          },
          line_items: [
            {
              name: plan.name,
              quantity: 1,
              unit_price: Number(plan.price) * 100,
            },
          ],
          charges: [
            {
              amount: Number(plan.price) * 100,
              payment_method: {
                type: paymentMethod.toLowerCase(),
                // TODO: Determine expiration
                expires_at: Number(
                  (addDays(new Date(), 10).getTime() / 1000).toFixed(),
                ),
              },
            },
          ],
          metadata: {
            orderId: order.id,
          },
        });

        await prisma.orders.update({
          where: {
            id: order.id,
          },
          data: {
            invoice_id: conektaOrder.data.id,
          },
        });

        return conektaOrder.data.charges?.data?.[0].payment_method;

        // TODO: Do something with the references, show them to the user on checkout or
        // send them to email
      } catch (e: any) {
        log.error(`There was an error creating an order with conekta: ${e}`);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'There was an error creating the order',
        });
      }
    },
  );
