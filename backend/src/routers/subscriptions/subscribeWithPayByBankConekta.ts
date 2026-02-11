import z from 'zod';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { getConektaCustomer } from './utils/getConektaCustomer';
import { conektaOrders } from '../../conekta';
import { OrderStatus } from './interfaces/order-status.interface';
import { log } from '../../server';
import { hasActiveSubscription } from './utils/hasActiveSub';
import { PaymentService } from './services/types';
import { Orders, Plans, PrismaClient, Users } from '@prisma/client';

const payByBankEnabled =
  process.env.CONEKTA_PBB_ENABLED === '1' ||
  process.env.CONEKTA_PAY_BY_BANK_ENABLED === '1';
const conektaPayByBankHeaders = {
  Accept: 'application/vnd.conekta-v2.2.0+json',
};

export const subscribeWithPayByBankConekta = shieldedProcedure
  .input(
    z
      .object({
        planId: z.number(),
        // Antifraude (Conekta Collect). Opcional, pero recomendado por Conekta.
        fingerprint: z.string().max(256).optional().nullable(),
      })
      .strict(),
  )
  .mutation(async ({ input: { planId, fingerprint }, ctx: { prisma, session } }) => {
    if (!payByBankEnabled) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Pago Directo (BBVA) deshabilitado temporalmente. Usa tarjeta, SPEI o efectivo.',
      });
    }

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

    const paymentMethodName = 'Conekta pay_by_bank';

    const plan = await prisma.plans.findFirst({
      where: { id: planId },
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
        message: 'Pago Directo (BBVA) solo está disponible para planes en pesos (MXN). Elige otro método de pago.',
      });
    }

    // Reusar checkout existente (si no expiró) para evitar crear múltiples links.
    const existingOrder = await prisma.orders.findFirst({
      where: {
        AND: [
          { user_id: user.id },
          { status: OrderStatus.PENDING },
          { payment_method: paymentMethodName },
          { plan_id: plan.id },
        ],
      },
    });

    if (existingOrder?.invoice_id) {
      try {
        const conektaOrder = await conektaOrders.getOrderById(
          existingOrder.invoice_id,
          undefined,
          undefined,
          { headers: conektaPayByBankHeaders },
        );
        const { url, deepLink, status } = extractPayByBankRedirectData(conektaOrder.data);

        // If still pending, reuse the same redirect URL.
        if (url && isPendingPayByBankStatus(status)) {
          return { url, deepLink };
        }
      } catch (e) {
        log.error(`[CONEKTA_PBB] Error reusing existing checkout: ${e}`);
      }
    }

    const order = await prisma.orders.create({
      data: {
        payment_method: paymentMethodName,
        user_id: user.id,
        status: OrderStatus.PENDING,
        date_order: new Date(),
        total_price: Number(plan.price),
        plan_id: plan.id,
      },
    });

    const fullUser = await prisma.users.findFirst({ where: { id: user.id } });
    if (!fullUser) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Usuario no encontrado' });
    }

    try {
      const conektaOrder = await createPayByBankOrder({
        plan,
        customerId: userConektaId,
        fingerprint,
        order,
        prisma,
        user: fullUser,
      });

      const { url, deepLink } = extractPayByBankRedirectData(conektaOrder.data);

      if (!url) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'No se pudo generar el link de pago BBVA. Intenta con SPEI, efectivo o tarjeta.',
        });
      }

      return { url, deepLink };
    } catch (e: any) {
      const conektaMsg = e?.response?.data?.message || e?.message;
      log.error(`[CONEKTA_PBB] Error creating order: ${conektaMsg}`, e?.response?.data);

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message:
          conektaMsg && typeof conektaMsg === 'string'
            ? `Conekta: ${conektaMsg}`
            : 'Ocurrió un error al crear la orden BBVA. Intenta de nuevo o usa otro método de pago.',
      });
    }
  });

const createPayByBankOrder = async ({
  plan,
  customerId,
  fingerprint,
  order,
  prisma,
  user,
}: {
  plan: Plans;
  customerId: string;
  fingerprint?: string | null;
  order: Orders;
  prisma: PrismaClient;
  user: Users;
}) => {
  const amountCents = Math.round(Number(plan.price) * 100);
  const fallbackCustomerInfo = buildConektaCustomerInfo(user);
  const hasCustomerId = typeof customerId === 'string' && customerId.trim().length > 0;
  const customerInfo = hasCustomerId
    ? { customer_id: customerId.trim() }
    : fallbackCustomerInfo;
  const shippingContact = buildConektaShippingContact(user, fallbackCustomerInfo);
  // Official Pago Directo BBVA docs use v2.2 and a direct order charge with:
  // - payment_method.type = "pay_by_bank"
  // - payment_method.product_type = "bbva_pay_by_bank"
  // It returns redirect_url / deep_link to complete the payment.
  const orderPayload: any = {
    currency: 'MXN' as const,
    customer_info: customerInfo,
    line_items: [
      {
        name: plan.name,
        quantity: 1,
        unit_price: amountCents,
      },
    ],
    charges: [
      {
        payment_method: {
          type: 'pay_by_bank',
          product_type: 'bbva_pay_by_bank',
        },
      },
    ],
    // Conekta's Pay by Bank examples include shipping fields as minimum required, even for digital goods.
    // Use a safe fallback address when the user has not provided one.
    shipping_lines: [{ amount: 0, carrier: 'FEDEX', method: 'Digital delivery' }],
    shipping_contact: shippingContact,
    metadata: {
      orderId: String(order.id),
      userId: String(user.id),
      customerId: customerId,
    },
    pre_authorize: false,
  };

  if (fingerprint && typeof fingerprint === 'string') {
    const safeFingerprint = fingerprint.trim();
    if (safeFingerprint.length > 0) {
      orderPayload.fingerprint = safeFingerprint;
    }
  }

  let conektaOrder;
  try {
    conektaOrder = await conektaOrders.createOrder(orderPayload, undefined, undefined, {
      headers: conektaPayByBankHeaders,
    });
  } catch (apiError: any) {
    const conektaData = apiError?.response?.data;
    const details = conektaData?.details
      ? JSON.stringify(conektaData.details)
      : conektaData?.message || apiError?.message;
    log.error(
      `[CONEKTA_PBB] createOrder failed: ${details}. Full response:`,
      conektaData || apiError?.response?.data,
    );
    throw apiError;
  }

  const conektaChargeIdRaw = (conektaOrder.data as any)?.charges?.data?.[0]?.id;
  const txnId =
    typeof conektaChargeIdRaw === 'string' && conektaChargeIdRaw.trim()
      ? conektaChargeIdRaw.trim()
      : conektaOrder.data.id;

  await prisma.orders.update({
    where: { id: order.id },
    data: {
      invoice_id: conektaOrder.data.id,
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
    phone: normalizeConektaPhone(user.phone),
  };
}

function buildConektaShippingContact(
  user: Users,
  customerInfo: { name: string; phone: string },
): {
  receiver: string;
  phone: string;
  address: { street1: string; postal_code: string; country: string; city?: string; state?: string };
} {
  const phoneDigits = normalizeConektaPhone(user.phone || customerInfo.phone);
  const formattedPhone = phoneDigits ? `+52${phoneDigits}` : '+520000000000';
  const street =
    typeof user.address === 'string' && user.address.trim()
      ? user.address.trim().slice(0, 120)
      : 'Digital goods';
  const city =
    typeof user.city === 'string' && user.city.trim()
      ? user.city.trim().slice(0, 80)
      : 'Ciudad de Mexico';

  return {
    receiver: (customerInfo?.name || user.username || `User ${user.id}`).slice(0, 120),
    phone: formattedPhone,
    address: {
      street1: street,
      // Use a real-looking ZIP to satisfy validation (fallback is fine for digital).
      postal_code: '06100',
      country: 'MX',
      city,
      state: 'CDMX',
    },
  };
}

function extractPayByBankRedirectData(
  conektaOrderData: any,
): { url: string | null; deepLink: string | null; status: string } {
  const charge = conektaOrderData?.charges?.data?.[0];
  const pm = charge?.payment_method;
  const readValue = (value: any): string | null =>
    typeof value === 'string' && value.trim() ? value.trim() : null;

  const url =
    readValue(pm?.redirect_url) ||
    readValue(pm?.url) ||
    readValue(charge?.redirect_url) ||
    readValue(conektaOrderData?.checkout?.url) ||
    null;

  const deepLink = readValue(pm?.deep_link) || readValue(pm?.deeplink) || null;
  const status = readValue(charge?.status)?.toLowerCase() || '';

  return { url, deepLink, status };
}

function isPendingPayByBankStatus(status: string): boolean {
  return status === 'pending_payment' || status === 'pending_confirmation' || status === 'pending';
}

function normalizeConektaPhone(phone: string | null | undefined): string {
  const digits = String(phone || '').replace(/\D/g, '');
  // Conekta examples use 10-digit phone numbers; keep last 10 digits if longer.
  if (digits.length >= 10) return digits.slice(-10);
  return '9999999999';
}
