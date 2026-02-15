import z from 'zod';
import { addDays } from 'date-fns';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { getConektaCustomer } from './utils/getConektaCustomer';
import { conektaOrders, conektaPaymentMethods } from '../../conekta';
import { OrderStatus } from './interfaces/order-status.interface';
import { log } from '../../server';
import { hasActiveSubscription } from './utils/hasActiveSub';
import { PaymentService } from './services/types';
import { Orders, Plans, PrismaClient, Users } from '@prisma/client';
import {
  formatConektaErrorForClient,
  getConektaErrorInfo,
  isConektaCustomerReferenceError,
  normalizeConektaPhoneE164Mx,
} from './utils/conektaErrorHelpers';

// Temporary hard-disable for cash/OXXO until provider flow is stabilized in production.
const cashEnabled = false;
const conektaCashHeaders = {
  Accept: 'application/vnd.conekta-v2.2.0+json',
};

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

      if (paymentMethod === 'cash' && !cashEnabled) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Pago en efectivo deshabilitado temporalmente. Usa tarjeta o SPEI.',
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
            undefined,
            undefined,
            { headers: conektaCashHeaders },
          );

          const charge = (conektaOrder.data.charges as any)?.data?.[0] as any;
          const paymentMethodObj = charge?.payment_method as any;
          const chargeStatus = String(charge?.status || '').toLowerCase();
          const orderPaymentStatus = String(
            (conektaOrder.data as any)?.payment_status || '',
          ).toLowerCase();
          const expiresAt =
            typeof paymentMethodObj?.expires_at === 'number'
              ? paymentMethodObj.expires_at
              : 0;
          const nowUnix = Math.floor(Date.now() / 1000);
          const isPending =
            chargeStatus === 'pending_payment' ||
            chargeStatus === 'pending_confirmation' ||
            orderPaymentStatus === 'pending_payment';
          const isExpired = Boolean(expiresAt > 0 && nowUnix >= expiresAt);

          // Check if the order is expired
          if (isExpired || !isPending) {
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

	            return ((newConektaOrder.data.charges as any)?.data?.[0]?.payment_method ?? null) as any;
	          }

	          return paymentMethodObj as any;
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
          date_order: new Date(),
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

	        return ((conektaOrder.data.charges as any)?.data?.[0]?.payment_method ?? null) as any;
	      } catch (e: any) {
	        const conektaMsg = formatConektaErrorForClient(e);
	        const conektaInfo = getConektaErrorInfo(e);
	        log.error(
          `[CONEKTA_CASH] Error creating order: ${conektaMsg}`,
          {
            status: conektaInfo.status,
            details: conektaInfo.detailMessages,
          },
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
  const expiresAt = Number(
    Math.floor(addDays(new Date(), 30).getTime() / 1000).toFixed(0),
  );
  const amountCents = Math.round(Number(plan.price) * 100);
  const hasCustomerId = typeof customerId === 'string' && customerId.trim().length > 0;
  const customerIdValue = customerId.trim();
  const fallbackCustomerInfo = buildConektaCustomerInfo(user);

  // SDK Conekta v6 (OpenAPI 2.1.0):
  // para SPEI recurrente se debe usar un payment_source_id de tipo spei_recurrent
  // en charges[].payment_method.payment_source_id.
  let speiRecurrentSourceId: string | null = null;
  if (paymentMethod === 'spei') {
    try {
	      if (!hasCustomerId) {
	        throw new Error('customer_id is required for spei_recurrent');
	      }
	      const existing = await conektaPaymentMethods.getCustomerPaymentMethods(
	        customerIdValue,
	      );
	      const existingSpei = (existing.data as any)?.data?.find(
	        (pm: any) => pm?.type === 'spei_recurrent',
	      );

      if (existingSpei?.id) {
        speiRecurrentSourceId = String(existingSpei.id);
      } else {
        const created = await conektaPaymentMethods.createCustomerPaymentMethods(
          customerIdValue,
          {
            type: 'spei_recurrent',
          } as any,
        );
        const createdId = (created.data as any)?.id;
        if (createdId) speiRecurrentSourceId = String(createdId);
      }
    } catch (e) {
      // No bloquear checkout: si falla spei_recurrent, seguimos con SPEI normal.
      log.error(
        `[CONEKTA_SPEI_RECURRENT] Unable to ensure spei_recurrent payment source for customer ${customerIdValue}: ${e}`,
      );
      speiRecurrentSourceId = null;
    }
  }

  const chargePaymentMethod: any = {
    type: paymentMethod.toLowerCase() as 'cash' | 'spei',
    expires_at: expiresAt,
  };
  if (paymentMethod === 'spei' && speiRecurrentSourceId) {
    chargePaymentMethod.payment_source_id = speiRecurrentSourceId;
  }

  const buildOrderPayload = (
    useCustomerId: boolean,
  ): any => ({
    currency: 'MXN' as const,
    customer_info: useCustomerId
      ? { customer_id: customerIdValue }
      : fallbackCustomerInfo,
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
        payment_method: chargePaymentMethod,
      },
    ],
    metadata: {
      orderId: String(order.id),
      userId: String(user.id),
      customerId: useCustomerId ? customerIdValue : null,
    },
    pre_authorize: false,
  });

  let orderPayload = buildOrderPayload(hasCustomerId);
  if (fingerprint && typeof fingerprint === 'string') {
    const safeFingerprint = fingerprint.trim();
    if (safeFingerprint.length > 0) {
      orderPayload.fingerprint = safeFingerprint;
    }
  }

  let conektaOrder;
  try {
    conektaOrder = await conektaOrders.createOrder(
      orderPayload,
      undefined,
      undefined,
      { headers: conektaCashHeaders },
    );
  } catch (firstError) {
    const firstInfo = getConektaErrorInfo(firstError);
    const shouldRetryWithoutCustomer =
      hasCustomerId && isConektaCustomerReferenceError(firstError);

    if (!shouldRetryWithoutCustomer) {
      log.error(
        `[CONEKTA_CASH] createOrder failed: ${firstInfo.message}`,
        {
          status: firstInfo.status,
          details: firstInfo.detailMessages,
        },
      );
      throw firstError;
    }

    log.warn(
      `[CONEKTA_CASH] createOrder failed with customer_id (${customerIdValue}). Retrying with customer_info object.`,
      {
        status: firstInfo.status,
        details: firstInfo.detailMessages,
      },
    );

    orderPayload = buildOrderPayload(false);
    if (fingerprint && typeof fingerprint === 'string') {
      const safeFingerprint = fingerprint.trim();
      if (safeFingerprint.length > 0) {
        orderPayload.fingerprint = safeFingerprint;
      }
    }

    conektaOrder = await conektaOrders.createOrder(
      orderPayload,
      undefined,
      undefined,
      { headers: conektaCashHeaders },
    );
  }

  const conektaChargeIdRaw = (conektaOrder.data as any)?.charges?.data?.[0]?.id;
  const txnId =
    typeof conektaChargeIdRaw === 'string' && conektaChargeIdRaw.trim()
      ? conektaChargeIdRaw.trim()
      : conektaOrder.data.id;

  await prisma.orders.update({
    where: {
      id: order.id,
    },
    data: {
      invoice_id: conektaOrder.data.id,
      // Store a stable identifier we can correlate with Conekta later.
      // `invoice_id` is the Conekta Order id (ord_...), and `txn_id` is best-effort:
      // - cash/spei may have a charge id
      // - otherwise fallback to order id
      txn_id: txnId,
    },
  });

  return conektaOrder;
};

function buildConektaCustomerInfo(user: Users): { name: string; email: string; phone: string } {
  const first = typeof user.first_name === 'string' ? user.first_name.trim() : '';
  const last = typeof user.last_name === 'string' ? user.last_name.trim() : '';
  const full = `${first} ${last}`.trim();
  const name = full || user.username || `User ${user.id}`;
  return {
    name: name.slice(0, 120),
    email: String(user.email || '').trim().slice(0, 200),
    phone: normalizeConektaPhoneE164Mx(user.phone),
  };
}
