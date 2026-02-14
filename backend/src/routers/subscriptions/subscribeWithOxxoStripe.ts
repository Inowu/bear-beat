import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { addDays } from 'date-fns';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { log } from '../../server';
import stripeOxxoInstance, { isStripeOxxoConfigured } from '../../stripe/oxxo';
import { OrderStatus } from './interfaces/order-status.interface';
import { PaymentService } from './services/types';
import type { Stripe } from 'stripe';
import bwipjs from 'bwip-js';

const toPositiveInt = (value: unknown): number | null => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  const i = Math.trunc(n);
  return i > 0 ? i : null;
};

const tryGenerateOxxoBarcodeDataUrl = async (referenceRaw: unknown): Promise<string> => {
  const reference = typeof referenceRaw === 'string' ? referenceRaw.trim() : '';
  if (!reference || reference.length < 6 || reference.length > 64) return '';

  try {
    const png: Buffer = await new Promise((resolve, reject) => {
      (bwipjs as any).toBuffer(
        {
          bcid: 'code128',
          text: reference,
          // Make the barcode chunky enough to remain readable inside the modal.
          scale: 4,
          height: 14,
          includetext: false,
          paddingwidth: 10,
          paddingheight: 8,
          barcolor: '000000',
          backgroundcolor: 'FFFFFF',
        },
        (err: unknown, buffer: Buffer) => {
          if (err) return reject(err);
          return resolve(buffer);
        },
      );
    });

    return `data:image/png;base64,${png.toString('base64')}`;
  } catch (err) {
    log.warn('[STRIPE_OXXO] Failed to render barcode image', {
      error: err instanceof Error ? err.message : err,
    });
    return '';
  }
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

const deriveOxxoOwnerName = (params: {
  fullNameRaw?: unknown;
  usernameRaw?: unknown;
  emailRaw?: unknown;
}): string => {
  const fullName = typeof params.fullNameRaw === 'string' ? params.fullNameRaw : '';
  const username = typeof params.usernameRaw === 'string' ? params.usernameRaw : '';
  const email = typeof params.emailRaw === 'string' ? params.emailRaw : '';
  const emailPrefix = email.includes('@') ? email.split('@')[0] ?? '' : email;

  const sanitize = (value: string): string => {
    const normalized = value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '');

    const lettersOnly = normalized
      .replace(/[^a-zA-Z ]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    const parts = lettersOnly.split(' ').filter(Boolean);
    // Stripe OXXO validates the owner name quite strictly. Avoid 1-2 letter initials and
    // always return 2 words with enough characters.
    const goodParts = parts.filter((p) => p.length >= 3);

    const toTitleCase = (s: string) =>
      s
        .split(' ')
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    if (goodParts.length >= 2) {
      // Keep it simple: first + last name only to avoid single-letter middles.
      return toTitleCase(`${goodParts[0]} ${goodParts[goodParts.length - 1]}`.slice(0, 60).trim());
    }
    if (goodParts.length === 1) {
      // If we only have one usable token, duplicate it to satisfy "first + last" validations.
      return toTitleCase(`${goodParts[0]} ${goodParts[0]}`.slice(0, 60).trim());
    }
    return '';
  };

  const candidates = [fullName, username, emailPrefix];
  for (const candidate of candidates) {
    const cleaned = sanitize(candidate);
    if (cleaned && cleaned.length >= 3) return cleaned;
  }
  return 'Cliente Cliente';
};

type StripeErrorShape = {
  type?: unknown;
  code?: unknown;
  statusCode?: unknown;
  requestId?: unknown;
  message?: unknown;
};

const toSafeString = (value: unknown, maxLen = 160): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
};

const sanitizeStripeError = (err: unknown) => {
  const e = err as StripeErrorShape;
  return {
    type: toSafeString(e?.type, 60),
    code: toSafeString(e?.code, 80),
    statusCode: typeof e?.statusCode === 'number' ? e.statusCode : null,
    requestId: toSafeString(e?.requestId, 80),
    message: toSafeString(e?.message),
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
          const barcodeDataUrl = await tryGenerateOxxoBarcodeDataUrl(voucher.reference);
          return {
            object: 'cash_payment',
            type: 'oxxo',
            reference: voucher.reference,
            barcode_url: barcodeDataUrl,
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

    let pi: Stripe.PaymentIntent;
    try {
      const dbUser = await prisma.users.findFirst({
        where: { id: user.id },
        select: {
          first_name: true,
          last_name: true,
          username: true,
          email: true,
        },
      });

      const fullNameCandidate = `${dbUser?.first_name ?? ''} ${dbUser?.last_name ?? ''}`.trim();
      const ownerName = deriveOxxoOwnerName({
        fullNameRaw: fullNameCandidate,
        usernameRaw: dbUser?.username ?? user.username,
        emailRaw: dbUser?.email ?? user.email,
      });
      pi = await stripeOxxoInstance.paymentIntents.create(
        {
          amount: amountCents,
          currency: 'mxn',
          confirm: true,
          payment_method_types: ['oxxo'],
          payment_method_data: {
            type: 'oxxo',
            billing_details: {
              email: user.email,
              name: ownerName,
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
    } catch (err) {
      const stripeError = sanitizeStripeError(err);
      log.error('[STRIPE_OXXO] Failed to create PaymentIntent', {
        orderId: order.id,
        userId: user.id,
        planId: plan.id,
        ...stripeError,
      });

      const type = stripeError.type ?? '';
      const code = stripeError.code ?? '';
      const typeLower = type.toLowerCase();
      const codeLower = code.toLowerCase();
      const message = (stripeError.message ?? '').toLowerCase();

      const isAuthError = typeLower === 'stripeauthenticationerror';
      const isInvalidOwnerName = codeLower === 'invalid_owner_name' || message.includes('owner name');
      const isPaymentMethodUnavailable =
        codeLower === 'payment_method_unactivated'
        || message.includes('oxxo')
        || message.includes('payment method');
      const isAccountDisabled =
        message.includes('charges are disabled')
        || message.includes('account cannot')
        || message.includes('not enabled for live charges');

      const reasonCode = [type, code].filter(Boolean).join(':') || 'unknown';
      const userMessage = isAuthError
        ? 'No pudimos autenticar el pago en efectivo. Intenta de nuevo o usa tarjeta/SPEI.'
        : isInvalidOwnerName
          ? 'Para generar la referencia OXXO necesitamos tu nombre completo (nombre + apellido). Actualízalo en tu cuenta o intenta con tarjeta/SPEI.'
        : isAccountDisabled
          ? 'La cuenta de pagos en efectivo no está lista para cobrar en vivo. Usa tarjeta/SPEI por ahora.'
          : isPaymentMethodUnavailable
            ? 'El pago en efectivo (OXXO) no está habilitado en este momento. Usa tarjeta/SPEI.'
            : `No pudimos generar la referencia de pago en efectivo. Usa tarjeta/SPEI. (Código: ${reasonCode})`;

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: userMessage,
      });
    }

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

    const barcodeDataUrl = await tryGenerateOxxoBarcodeDataUrl(voucher.reference);

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
      barcode_url: barcodeDataUrl,
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
