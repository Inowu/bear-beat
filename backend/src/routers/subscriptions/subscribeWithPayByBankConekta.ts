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
        const conektaOrder = await conektaOrders.getOrderById(existingOrder.invoice_id);
        const charge = (conektaOrder.data as any)?.charges?.data?.[0];
        const pm = charge?.payment_method;
        const redirectUrl = typeof pm?.redirect_url === 'string' ? pm.redirect_url : null;
        const deepLink = typeof pm?.deep_link === 'string' ? pm.deep_link : null;
        const status = typeof charge?.status === 'string' ? charge.status.toLowerCase() : '';

        // If still pending, reuse the same redirect URL.
        if (redirectUrl && status === 'pending_payment') {
          return { url: redirectUrl, deepLink };
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

      const charge = (conektaOrder.data as any)?.charges?.data?.[0];
      const pm = charge?.payment_method;
      const url = typeof pm?.redirect_url === 'string' ? pm.redirect_url : null;
      const deepLink = typeof pm?.deep_link === 'string' ? pm.deep_link : null;

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
  const customerInfo = buildConektaCustomerInfo(user);
  const shippingContact = buildConektaShippingContact(user, customerInfo);
  // Per official docs (2025-2026): Pago Directo BBVA uses a direct order charge with:
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
    shipping_lines: [{ amount: 0, carrier: 'digital' }],
    shipping_contact: shippingContact,
    metadata: {
      orderId: String(order.id),
      userId: String(user.id),
      customerId: customerId,
    },
    pre_authorize: false,
  };

  if (fingerprint && typeof fingerprint === 'string') {
    orderPayload.fingerprint = fingerprint;
  }

  const conektaOrder = await conektaOrders.createOrder(orderPayload);

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
      : undefined;

  return {
    receiver: (customerInfo?.name || user.username || `User ${user.id}`).slice(0, 120),
    phone: formattedPhone,
    address: {
      street1: street,
      // Use a real-looking ZIP to satisfy validation (fallback is fine for digital).
      postal_code: '06100',
      country: 'MX',
      ...(city ? { city } : {}),
    },
  };
}

function normalizeConektaPhone(phone: string | null | undefined): string {
  const digits = String(phone || '').replace(/\D/g, '');
  // Conekta examples use 10-digit phone numbers; keep last 10 digits if longer.
  if (digits.length >= 10) return digits.slice(-10);
  return '9999999999';
}
