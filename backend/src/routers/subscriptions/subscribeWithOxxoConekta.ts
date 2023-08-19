import { z } from 'zod';
import { addDays } from 'date-fns';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { getConektaCustomer } from './utils/getConektaCustomer';
import { conektaOrders } from '../../conekta';
import { OrderStatus } from './interfaces/order-status.interface';

export const subscribeWithOxxoConekta = shieldedProcedure
  .input(
    z.object({
      planId: z.number(),
      currency: z.union([z.literal('MXN'), z.literal('USD')]),
    }),
  )
  .mutation(
    async ({ input: { planId, currency }, ctx: { prisma, session } }) => {
      const userConektaId = await getConektaCustomer({
        prisma,
        user: session?.user,
      });

      const plan = await prisma.plans.findFirstOrThrow({
        where: {
          id: planId,
        },
      });

      const order = await prisma.orders.create({
        data: {
          payment_method: 'Oxxo',
          user_id: session!.user!.id,
          status: OrderStatus.PENDING,
          date_order: new Date().toISOString(),
          total_price: Number(plan.price),
        },
      });

      const conektaOrder = await conektaOrders.createOrder({
        currency,
        customer_info: {
          customer_id: userConektaId,
        },
        line_items: [
          {
            name: plan.name,
            quantity: 1,
            unit_price: Number(plan.price),
          },
        ],
        charges: [
          {
            amount: Number(plan.price),
            payment_method: {
              type: 'oxxo',
              expires_at: addDays(new Date(), 10).getTime(),
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
    },
  );
