import z from 'zod';
import { addDays, compareAsc } from 'date-fns';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { getConektaCustomer } from './utils/getConektaCustomer';
import { conektaOrders } from '../../conekta';
import { OrderStatus } from './interfaces/order-status.interface';
import { log } from '../../server';
import { hasActiveSubscription } from './utils/hasActiveSub';
import { PaymentService } from './services/types';
import { Orders, Plans, PrismaClient } from '@prisma/client';
import { SessionUser } from '../auth/utils/serialize-user';

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

      await hasActiveSubscription({
        user,
        customerId: userConektaId,
        prisma,
        service: PaymentService.CONEKTA,
      });

      const paymentMethodName = `Conekta ${paymentMethod}`;

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
              payment_method: paymentMethodName,
            },
          ],
        },
      });

      if (existingOrder) {
        try {
          const conektaOrder = await conektaOrders.getOrderById(
            existingOrder.invoice_id!,
          );

          // Check if the order is expired
          if (
            compareAsc(
              new Date(),
              new Date(
                ((conektaOrder.data.charges?.data?.[0].payment_method as any)
                  ?.expires_at ?? 0) * 1000,
              ),
            ) >= 0
          ) {
            log.info(
              `[CONEKTA_CASH] Order ${existingOrder.id} is expired, creating a new one`,
            );

            const newConektaOrder = await createCashPaymentOrder({
              plan,
              customerId: userConektaId,
              paymentMethod,
              order: existingOrder,
              prisma,
              user,
            });

            return newConektaOrder.data.charges?.data?.[0]
              .payment_method as any;
          }

          return conektaOrder.data.charges?.data?.[0].payment_method as any;
        } catch (e) {
          log.error(
            `[CONEKTA_CASH] There was an error getting the order with conekta: ${e}`,
          );
        }
      }

      const order = await prisma.orders.create({
        data: {
          payment_method: paymentMethodName,
          user_id: session!.user!.id,
          status: OrderStatus.PENDING,
          date_order: new Date().toISOString(),
          total_price: Number(plan.price),
          plan_id: plan.id,
        },
      });

      try {
        const conektaOrder = await createCashPaymentOrder({
          plan,
          customerId: userConektaId,
          paymentMethod,
          order,
          prisma,
          user,
        });

        return conektaOrder.data.charges?.data?.[0].payment_method as any;
      } catch (e: any) {
        log.error(
          `[CONEKTA_CASH] There was an error creating an order with conekta: ${e}`,
        );

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Ocurrió un error al crear la orden',
        });
      }
    },
  );

const createCashPaymentOrder = async ({
  plan,
  customerId,
  paymentMethod,
  order,
  prisma,
  user,
}: {
  plan: Plans;
  customerId: string;
  paymentMethod: 'cash' | 'spei';
  order: Orders;
  prisma: PrismaClient;
  user: SessionUser;
}) => {
  const conektaOrder = await conektaOrders.createOrder({
    currency: plan.moneda.toUpperCase(),
    customer_info: {
      customer_id: customerId,
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
          expires_at: Number(
            (addDays(new Date(), 30).getTime() / 1000).toFixed(),
          ),
        },
      },
    ],
    metadata: {
      orderId: order.id,
      userId: user.id,
    },
  });

  await prisma.orders.update({
    where: {
      id: order.id,
    },
    data: {
      invoice_id: conektaOrder.data.id,
      txn_id: (conektaOrder.data.object as any).id,
    },
  });

  return conektaOrder;
};
