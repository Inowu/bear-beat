import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { addDays } from 'date-fns';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { log } from '../../server';
import stripeOxxoInstance, { isStripeOxxoConfigured } from '../../stripe/oxxo';
import { OrderStatus } from './interfaces/order-status.interface';
import { PaymentService } from './services/types';
import type { Stripe } from 'stripe';

const toPositiveInt = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
};

const extractOxxoVoucher = (
  pi: Stripe.PaymentIntent,
): { reference: string; hostedVoucherUrl: string | null; expiresAt: number | null } | null => {
  const nextAction: any = (pi as any)?.next_action;
  const details: any =
    nextAction?.oxxo_display_details
    || nextAction?.display_oxxo_details
    || null;

  const reference = typeof details?.number === 'string' ? details.number.trim() : '';
  const hostedVoucherUrl =
    typeof details?.hosted_voucher_url === 'string' ? details.hosted_voucher_url.trim() : '';

  const expiresAt =
    typeof details?.expires_after === 'number'
      ? details.expires_after
      : typeof details?.expires_at === 'number'
        ? details.expires_at
        : null;

  if (!reference && !hostedVoucherUrl) return null;

  return {
    reference,
    hostedVoucherUrl: hostedVoucherUrl || null,
    expiresAt,
  };
};

/**
 * Stripe OXXO (cash) flow:
 * - Creates a PaymentIntent in a separate Stripe account (configured via STRIPE_OXXO_* env vars)
 * - Confirms server-side and returns voucher details to show to the user.
 *
 * NOTE: OXXO is a one-time cash payment method (non-recurring). Access is granted after webhook confirmation.
 */
export const subscribeWithOxxoStripe = shieldedProcedure
  .input(
    z
      .object({
        planId: z.number(),
      })
      .strict(),
  )
  .mutation(async ({ input: { planId }, ctx: { prisma, session } }) => {
    if (!isStripeOxxoConfigured()) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Pago en efectivo no está disponible en este momento. Usa tarjeta o SPEI.',
      });
    }

    const user = session!.user!;

    const plan = await prisma.plans.findFirst({
      where: { id: planId },
    });

    if (!plan) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Ese plan no existe',
      });
    }

    if (plan.moneda?.toUpperCase() !== 'MXN') {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Este método de pago solo está disponible para planes en pesos (MXN). Elige otro método.',
      });
    }

    // Block if user already has an active subscription in our DB (regardless of provider).
    const existingSubscription = await prisma.descargasUser.findFirst({
      where: {
        AND: [{ user_id: user.id }, { date_end: { gte: new Date() } }],
      },
      orderBy: [{ date_end: 'desc' }, { id: 'desc' }],
      select: { order_id: true },
    });

    if (existingSubscription) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'Ya tienes una membresía activa. Para evitar doble membresía no puedes comprar otro plan todavía. Si se te acabaron los GB, compra GB extra en Mi cuenta.',
      });
    }

    const paymentMethodName = PaymentService.STRIPE_OXXO;

    // Reuse an existing pending voucher if still valid.
    const pendingOrder = await prisma.orders.findFirst({
      where: {
        AND: [
          { user_id: user.id },
          { status: OrderStatus.PENDING },
          { payment_method: paymentMethodName },
          { plan_id: plan.id },
        ],
      },
      orderBy: [{ id: 'desc' }],
    });

    if (pendingOrder?.invoice_id && String(pendingOrder.invoice_id).startsWith('pi_')) {
      try {
        const existingPi = await stripeOxxoInstance.paymentIntents.retrieve(String(pendingOrder.invoice_id));
        const voucher = extractOxxoVoucher(existingPi as Stripe.PaymentIntent);
        const expiresAt = voucher?.expiresAt ?? 0;
        const nowUnix = Math.floor(Date.now() / 1000);
        const isExpired = Boolean(expiresAt > 0 && nowUnix >= expiresAt);
        const status = String((existingPi as any)?.status ?? '').toLowerCase();
        const isStillPending = status === 'requires_action' || status === 'requires_payment_method' || status === 'processing';

        if (voucher && !isExpired && isStillPending) {
          return {
            object: 'cash_payment',
            type: 'oxxo',
            reference: voucher.reference,
            barcode_url: '',
            hosted_voucher_url: voucher.hostedVoucherUrl,
            expires_at: expiresAt,
            auth_code: null,
            cashier_id: null,
            store: null,
            store_name: 'OXXO',
            sotre_name: 'OXXO',
            service_name: 'OxxoPay',
          };
        }
      } catch (e) {
        log.warn('[STRIPE_OXXO] Failed to reuse pending PaymentIntent, creating a new one', {
          orderId: pendingOrder.id,
          error: e instanceof Error ? e.message : e,
        });
      }
    }

    const order = await prisma.orders.create({
      data: {
        user_id: user.id,
        status: OrderStatus.PENDING,
        is_plan: 1,
        plan_id: plan.id,
        payment_method: paymentMethodName,
        date_order: new Date(),
        total_price: Number(plan.price),
      },
    });

    const amountCents = Math.round(Number(plan.price) * 100);
    if (!Number.isFinite(amountCents) || amountCents <= 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No se pudo calcular el monto a cobrar para este plan.',
      });
    }

    // OXXO voucher expiration: default is OK, but make it explicit.
    const expiresAfterDays = (() => {
      const fromEnv = toPositiveInt(process.env.STRIPE_OXXO_EXPIRES_AFTER_DAYS);
      if (fromEnv && fromEnv <= 30) return fromEnv;
      return 3;
    })();

    const pi = await stripeOxxoInstance.paymentIntents.create(
      {
        amount: amountCents,
        currency: 'mxn',
        confirm: true,
        payment_method_types: ['oxxo'],
        payment_method_data: {
          type: 'oxxo',
          billing_details: {
            email: user.email,
            name: user.username,
          },
        } as any,
        payment_method_options: {
          oxxo: {
            expires_after_days: expiresAfterDays,
          },
        } as any,
        description: `Plan ${plan.name} (OXXO)`,
        metadata: {
          orderId: String(order.id),
          userId: String(user.id),
          planId: String(plan.id),
          bb_kind: 'plan',
          bb_provider: 'stripe_oxxo',
        },
      },
      { idempotencyKey: `stripe-oxxo-order-${order.id}` },
    );

    const voucher = extractOxxoVoucher(pi as Stripe.PaymentIntent);
    if (!voucher) {
      log.error('[STRIPE_OXXO] PaymentIntent created without voucher details', {
        orderId: order.id,
        paymentIntentId: (pi as any)?.id ?? null,
        status: (pi as any)?.status ?? null,
      });
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'No pudimos generar la referencia de pago en efectivo. Intenta de nuevo.',
      });
    }

    try {
      await prisma.orders.update({
        where: { id: order.id },
        data: {
          invoice_id: pi.id,
          txn_id: pi.id,
        },
      });
    } catch (e) {
      log.warn('[STRIPE_OXXO] Failed to persist PaymentIntent id on order (non-blocking)', {
        orderId: order.id,
        paymentIntentId: pi.id,
        error: e instanceof Error ? e.message : e,
      });
    }

    return {
      object: 'cash_payment',
      type: 'oxxo',
      reference: voucher.reference,
      barcode_url: '',
      hosted_voucher_url: voucher.hostedVoucherUrl,
      expires_at: voucher.expiresAt ?? 0,
      auth_code: null,
      cashier_id: null,
      store: null,
      store_name: 'OXXO',
      sotre_name: 'OXXO',
      service_name: 'OxxoPay',
    };
  });
