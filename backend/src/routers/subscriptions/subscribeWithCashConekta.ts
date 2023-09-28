import z from 'zod';
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
  // .output(
  //   z.union([
  //     z.object({
  //       object: z.literal('cash_payment'),
  //       type: z.literal('oxxo'),
  //       auth_code: z.number().optional(),
  //       barcode_url: z.string(),
  //       cashier_id: z.any(),
  //       expires_at: z.number().optional(),
  //       reference: z.string(),
  //       service_name: z.literal('OxxoPay'),
  //       store: z.any(),
  //       store_name: z.literal('OXXO'),
  //     }),
  //     z.object({
  //       type: z.literal('spei'),
  //       bank: z.literal('STP'),
  //       clabe: z.string(),
  //       description: z.any().nullable(),
  //       executed_at: z.number().nullable(),
  //       expires_at: z.number().optional(),
  //       issuing_account_bank: z.any().nullable(),
  //       issuing_account_holder_name: z.any().nullable(),
  //       issuing_account_number: z.any().nullable(),
  //       issuing_account_tax_id: z.any().nullable(),
  //       object: z.literal('bank_transfer_payment'),
  //       payment_attempts: z.array(z.any()),
  //       receiving_account_bank: z.literal('STP'),
  //       receiving_account_holder_name: z.any().nullable(),
  //       receiving_account_number: z.string(),
  //       receiving_account_tax_id: z.any().nullable(),
  //       reference_number: z.any().nullable(),
  //       tracking_code: z.any().nullable(),
  //     }),
  //   ]),
  // )
  .mutation(
    async ({ input: { planId, paymentMethod }, ctx: { prisma, session } }) => {
      const userConektaId = await getConektaCustomer({
        prisma,
        user: session?.user,
      });

      const user = session!.user!;

      await hasActiveSubscription(user, userConektaId, prisma, 'cash');

      const plan = await prisma.plans.findFirst({
        where: {
          id: planId,
        },
      });

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'El plan especificado no existe',
        });
      }

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
          message: 'Ya existe una orden pendiente con este método de pago',
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

        return conektaOrder.data.charges?.data?.[0].payment_method as any;

        // TODO: Do something with the references, show them to the user on checkout or
        // send them to email
      } catch (e: any) {
        log.error(`There was an error creating an order with conekta: ${e}`);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Ocurrió un error al crear la orden',
        });
      }
    },
  );
