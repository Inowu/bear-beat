import z from 'zod';
import { addDays, compareAsc } from 'date-fns';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { getConektaCustomer } from './utils/getConektaCustomer';
import { conektaOrders, conektaPaymentMethods } from '../../conekta';
import { OrderStatus } from './interfaces/order-status.interface';
import { log } from '../../server';
import { hasActiveSubscription } from './utils/hasActiveSub';
import { PaymentService } from './services/types';
import { Orders, Plans, PrismaClient, Users } from '@prisma/client';

const oxxoEnabled = process.env.CONEKTA_OXXO_ENABLED === '1';

export const subscribeWithCashConekta = shieldedProcedure
  .input(
    z
      .object({
        planId: z.number(),
        paymentMethod: z.union([z.literal('cash'), z.literal('spei')]),
        // Antifraude (Conekta Collect). Opcional, pero recomendado por Conekta.
        fingerprint: z.string().max(256).optional().nullable(),
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
    async ({
      input: { planId, paymentMethod, fingerprint },
      ctx: { prisma, session },
    }) => {
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

      if (plan.moneda?.toUpperCase() !== 'MXN') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Este método de pago solo está disponible para planes en pesos (MXN). Elige otro método de pago.',
        });
      }

      if (paymentMethod === 'cash' && !oxxoEnabled) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Pago en OXXO deshabilitado temporalmente. Usa tarjeta o SPEI.',
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
            {
              plan_id: plan.id,
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
            ) >= 0 ||
            conektaOrder.data.charges?.data?.[0].status !== 'pending_payment'
          ) {
            log.info(
              `[CONEKTA_CASH] Order ${existingOrder.id} is expired, creating a new one`,
            );

            const fullUserForOrder = await prisma.users.findFirst({
              where: { id: user.id },
            });
            if (!fullUserForOrder) throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuario no encontrado' });
            const newConektaOrder = await createCashPaymentOrder({
              plan,
              customerId: userConektaId,
              paymentMethod,
              fingerprint,
              order: existingOrder,
              prisma,
              user: fullUserForOrder,
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

      const fullUser = await prisma.users.findFirst({
        where: { id: session!.user!.id },
      });
      if (!fullUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Usuario no encontrado',
        });
      }

      try {
        const conektaOrder = await createCashPaymentOrder({
          plan,
          customerId: userConektaId,
          paymentMethod,
          fingerprint,
          order,
          prisma,
          user: fullUser,
        });

        return conektaOrder.data.charges?.data?.[0].payment_method as any;
      } catch (e: any) {
        const conektaMsg = e?.response?.data?.message || e?.message;
        log.error(
          `[CONEKTA_CASH] Error creating order: ${conektaMsg}`,
          e?.response?.data,
        );

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            conektaMsg && typeof conektaMsg === 'string'
              ? `Conekta: ${conektaMsg}`
              : 'Ocurrió un error al crear la orden. Intenta de nuevo o usa otro método de pago.',
        });
      }
    },
  );

const createCashPaymentOrder = async ({
  plan,
  customerId,
  paymentMethod,
  fingerprint,
  order,
  prisma,
  user,
}: {
  plan: Plans;
  customerId: string;
  paymentMethod: 'cash' | 'spei';
  fingerprint?: string | null;
  order: Orders;
  prisma: PrismaClient;
  user: Users;
}) => {
  const expiresAt = Math.floor(addDays(new Date(), 30).getTime() / 1000);
  const amountCents = Math.round(Number(plan.price) * 100);

  // Conekta \"SPEI recurrente\":
  // 1) el cliente debe tener un payment_source tipo \"spei_recurrent\"
  // 2) al crear la orden SPEI, incluir reuse_customer_clabe: true para reutilizar la misma CLABE
  // Docs: https://developers.conekta.com/docs/cargos-con-referencia-recurrente
  let reuseCustomerClabe = false;
  if (paymentMethod === 'spei') {
    try {
      const existing = await conektaPaymentMethods.getCustomerPaymentMethods(
        customerId,
      );
      const hasSpeiRecurrent =
        existing.data?.data?.some(
          (pm: any) => pm?.type === 'spei_recurrent',
        ) ?? false;

      if (!hasSpeiRecurrent) {
        await conektaPaymentMethods.createCustomerPaymentMethods(customerId, {
          type: 'spei_recurrent',
        } as any);
      }

      reuseCustomerClabe = true;
    } catch (e) {
      // No bloquear el checkout si el payment_source no se puede crear/leer:
      // seguimos con SPEI normal (CLABE puede cambiar por orden).
      log.error(
        `[CONEKTA_SPEI_RECURRENT] Unable to ensure spei_recurrent payment source for customer ${customerId}: ${e}`,
      );
      reuseCustomerClabe = false;
    }
  }

  // Según SDK Conekta (get_order_cash_request): usar customer_id cuando existe
  // y pre_authorize: false para pagos cash/spei.
  const orderPayload: any = {
    currency: 'MXN' as const,
    customer_info: {
      customer_id: customerId,
    },
    line_items: [
      {
        name: plan.name,
        quantity: 1,
        unit_price: amountCents,
      },
    ],
    charges: [
      {
        amount: amountCents,
        payment_method: {
          type: paymentMethod.toLowerCase() as 'cash' | 'spei',
          expires_at: expiresAt,
        },
      },
    ],
    metadata: {
      orderId: String(order.id),
      userId: String(user.id),
    },
    pre_authorize: false,
  };

  if (fingerprint && typeof fingerprint === 'string') {
    orderPayload.fingerprint = fingerprint;
  }

  if (reuseCustomerClabe) {
    orderPayload.reuse_customer_clabe = true;
  }

  let conektaOrder;
  try {
    conektaOrder = await conektaOrders.createOrder(orderPayload);
  } catch (apiError: any) {
    const conektaData = apiError?.response?.data;
    const details = conektaData?.details
      ? JSON.stringify(conektaData.details)
      : conektaData?.message || apiError?.message;
    log.error(
      `[CONEKTA_CASH] createOrder failed: ${details}. Full response:`,
      conektaData || apiError?.response?.data,
    );
    throw apiError;
  }

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
