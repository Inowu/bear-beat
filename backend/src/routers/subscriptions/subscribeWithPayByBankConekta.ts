import z from 'zod';
import { addHours, compareAsc } from 'date-fns';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { getConektaCustomer } from './utils/getConektaCustomer';
import { conektaOrders } from '../../conekta';
import { OrderStatus } from './interfaces/order-status.interface';
import { log } from '../../server';
import { hasActiveSubscription } from './utils/hasActiveSub';
import { PaymentService } from './services/types';
import { Orders, Plans, PrismaClient, Users } from '@prisma/client';

const payByBankEnabled = process.env.CONEKTA_PBB_ENABLED === '1';

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
        const checkout = (conektaOrder.data as any)?.checkout;
        const checkoutUrl = typeof checkout?.url === 'string' ? checkout.url : null;
        const expiresAt = typeof checkout?.expires_at === 'number' ? checkout.expires_at : null;
        const status = typeof checkout?.status === 'string' ? checkout.status : '';

        if (
          checkoutUrl &&
          expiresAt &&
          compareAsc(new Date(), new Date(expiresAt * 1000)) < 0 &&
          status.toLowerCase() !== 'expired' &&
          status.toLowerCase() !== 'cancelled'
        ) {
          return { url: checkoutUrl, expires_at: expiresAt };
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

      const checkout = (conektaOrder.data as any)?.checkout;
      const url = typeof checkout?.url === 'string' ? checkout.url : null;
      const expiresAt = typeof checkout?.expires_at === 'number' ? checkout.expires_at : null;

      if (!url) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'No se pudo generar el link de pago BBVA. Intenta con SPEI, efectivo o tarjeta.',
        });
      }

      return { url, expires_at: expiresAt };
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
  const clientUrlRaw = process.env.CLIENT_URL || 'https://thebearbeat.com';
  const clientUrl = clientUrlRaw.replace(/\/+$/, '');
  const expiresAt = Math.floor(addHours(new Date(), 1).getTime() / 1000);
  const amountCents = Math.round(Number(plan.price) * 100);
  const customerInfo = buildConektaCustomerInfo(user);
  const shippingContact = buildConektaShippingContact(user, customerInfo);

  const orderPayload: any = {
    currency: 'MXN' as const,
    // Note: Per Conekta docs (2025-2026), Pago Directo can be used without a stored customer.
    // We still keep `customerId` in our system for subscription checks, but the order payload
    // provides explicit contact fields to satisfy required validations (phone, etc).
    customer_info: customerInfo,
    line_items: [
      {
        name: plan.name,
        quantity: 1,
        unit_price: amountCents,
      },
    ],
    // Required for checkout validation even for digital goods.
    shipping_lines: [{ amount: 0 }],
    shipping_contact: shippingContact,
    checkout: {
      allowed_payment_methods: ['pay_by_bank'],
      expires_at: expiresAt,
      success_url: `${clientUrl}/comprar/success?order_id=${order.id}`,
      failure_url: `${clientUrl}/comprar?priceId=${plan.id}&bbva=failed`,
      name: `Pago BBVA - ${plan.name}`,
      type: 'HostedPayment',
    },
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
      // HostedPayment doesn't always create a charge immediately, so fallback to Order id.
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

function normalizeConektaPhone(phone: string | null | undefined): string {
  const digits = String(phone || '').replace(/\D/g, '');
  // Conekta examples use 10-digit phone numbers; keep last 10 digits if longer.
  if (digits.length >= 10) return digits.slice(-10);
  return '9999999999';
}

function buildConektaShippingContact(
  user: Users,
  customerInfo: { name: string; email: string; phone: string },
): any {
  const street1 = typeof user.address === 'string' && user.address.trim() ? user.address.trim() : 'Digital';
  const city = typeof user.city === 'string' && user.city.trim() ? user.city.trim() : 'Ciudad de Mexico';
  const country = typeof user.country_id === 'string' && user.country_id.trim() ? user.country_id.trim() : 'MX';
  // For digital goods we may not have a real shipping address. Use a stable fallback to satisfy schema.
  const postalCode = '06600';
  return {
    receiver: customerInfo.name,
    phone: customerInfo.phone,
    address: {
      street1: street1.slice(0, 240),
      city: city.slice(0, 80),
      state: 'CDMX',
      country: country.toUpperCase().slice(0, 2),
      postal_code: postalCode,
    },
  };
}
