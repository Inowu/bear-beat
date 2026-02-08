import { PrismaClient } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import stripeInstance from '../stripe';
import { log } from '../server';

export const OFFER_KEYS = {
  PLANS_NO_CHECKOUT: 'plans_no_checkout',
} as const;

export type OfferKey = (typeof OFFER_KEYS)[keyof typeof OFFER_KEYS];

export type ResolvedCheckoutCoupon =
  | {
      couponCode: string;
      source: 'requested' | 'offer';
      percentOff: number | null;
      offerId: number | null;
    }
  | {
      couponCode: null;
      source: null;
      percentOff: null;
      offerId: null;
    };

const MAX_COUPON_CODE_LEN = 15;

export function resolveOfferCouponCode(userId: number, percentOff: number): string {
  // Fits Cupons.code VARCHAR(15) and Stripe coupon id.
  const prefix = `BB${Math.max(0, Math.min(99, Math.floor(percentOff)))}`;
  const code = `${prefix}U${userId}`;
  return code.slice(0, MAX_COUPON_CODE_LEN);
}

const isStripeConfigured = (): boolean => {
  const hasLive = Boolean(process.env.STRIPE_KEY?.trim());
  const hasTest = Boolean(process.env.STRIPE_TEST_KEY?.trim());
  return hasLive || hasTest;
};

async function ensureStripeCoupon(code: string, percentOff: number): Promise<void> {
  if (!isStripeConfigured()) {
    log.warn('[OFFERS] Stripe keys not configured, cannot ensure coupon exists', { code });
    return;
  }

  try {
    await stripeInstance.coupons.retrieve(code);
    return;
  } catch {
    // continue to create
  }

  try {
    await stripeInstance.coupons.create({
      id: code,
      name: code,
      percent_off: percentOff,
      duration: 'once',
    });
    log.info('[OFFERS] Stripe coupon created', { code, percentOff });
  } catch (e) {
    log.error('[OFFERS] Failed to create Stripe coupon', {
      code,
      percentOff,
      error: e instanceof Error ? e.message : e,
    });
  }
}

async function ensureDbCoupon(prisma: PrismaClient, code: string, percentOff: number): Promise<void> {
  const existing = await prisma.cupons.findFirst({
    where: { code },
    select: { id: true, discount: true, active: true },
  });

  if (existing) {
    // Keep discount stable; only ensure it's active.
    if (existing.active !== 1) {
      await prisma.cupons.update({
        where: { code },
        data: { active: 1 },
      });
    }
    return;
  }

  await prisma.cupons.create({
    data: {
      code,
      discount: percentOff,
      type: 1,
      description: `Oferta automatizada ${percentOff}%`,
      active: 1,
    },
  });
}

export async function upsertUserOfferAndCoupon(params: {
  prisma: PrismaClient;
  userId: number;
  offerKey: OfferKey;
  stage: number;
  percentOff: number;
  expiresAt: Date;
}): Promise<{ offerId: number; couponCode: string | null; percentOff: number }> {
  const { prisma, userId, offerKey, stage, percentOff, expiresAt } = params;
  const code = resolveOfferCouponCode(userId, percentOff);

  const existing = await prisma.userOffer.findFirst({
    where: {
      user_id: userId,
      offer_key: offerKey,
      stage,
    },
    select: { id: true, coupon_code: true, percent_off: true },
  });

  if (existing) {
    return {
      offerId: existing.id,
      couponCode: existing.coupon_code ?? null,
      percentOff: existing.percent_off,
    };
  }

  // Best-effort: ensure coupon exists in both DB and Stripe so checkout can apply it.
  await ensureDbCoupon(prisma, code, percentOff);
  await ensureStripeCoupon(code, percentOff);

  const created = await prisma.userOffer.create({
    data: {
      user_id: userId,
      offer_key: offerKey,
      stage,
      percent_off: percentOff,
      coupon_code: code,
      expires_at: expiresAt,
    },
    select: { id: true },
  });

  return {
    offerId: created.id,
    couponCode: code,
    percentOff,
  };
}

export async function resolveCheckoutCoupon(params: {
  prisma: PrismaClient;
  userId: number;
  requestedCoupon?: string | null;
}): Promise<ResolvedCheckoutCoupon> {
  const { prisma, userId, requestedCoupon } = params;
  const now = new Date();

  const normalize = (raw: unknown): string => String(raw || '').trim().slice(0, MAX_COUPON_CODE_LEN);
  const coupon = requestedCoupon ? normalize(requestedCoupon) : '';

  const assertCouponNotUsed = async (couponId: number) => {
    const used = await prisma.cuponsUsed.findFirst({
      where: { user_id: userId, cupon_id: couponId },
      select: { id: true },
    });
    if (used) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Ese cupón ya fue usado',
      });
    }
  };

  if (coupon) {
    const dbCoupon = await prisma.cupons.findFirst({
      where: { code: coupon, active: 1 },
    });
    if (!dbCoupon) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Ese cupón no existe' });
    }

    // If the coupon is user-bound (exists in user_offers), enforce ownership.
    const boundOffer = await prisma.userOffer.findFirst({
      where: { coupon_code: coupon },
      select: { id: true, user_id: true, expires_at: true, redeemed_at: true, percent_off: true },
    });
    if (boundOffer) {
      if (boundOffer.user_id !== userId) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Ese cupón no está disponible para tu cuenta',
        });
      }
      if (boundOffer.redeemed_at) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ese cupón ya fue usado' });
      }
      if (boundOffer.expires_at <= now) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: 'Ese cupón ya expiró' });
      }
    }

    await assertCouponNotUsed(dbCoupon.id);

    return {
      couponCode: coupon,
      source: 'requested',
      percentOff: boundOffer?.percent_off ?? dbCoupon.discount ?? null,
      offerId: boundOffer?.id ?? null,
    };
  }

  // Auto-apply best active offer (if any).
  const bestOffer = await prisma.userOffer.findFirst({
    where: {
      user_id: userId,
      redeemed_at: null,
      expires_at: { gt: now },
      coupon_code: { not: null },
    },
    orderBy: [{ percent_off: 'desc' }, { created_at: 'desc' }],
  });

  if (!bestOffer?.coupon_code) {
    return { couponCode: null, source: null, percentOff: null, offerId: null };
  }

  const dbCoupon = await prisma.cupons.findFirst({
    where: { code: bestOffer.coupon_code, active: 1 },
    select: { id: true, discount: true },
  });
  if (dbCoupon) {
    // If user already used it (or it was marked used early), skip auto-apply.
    const used = await prisma.cuponsUsed.findFirst({
      where: { user_id: userId, cupon_id: dbCoupon.id },
      select: { id: true },
    });
    if (used) {
      return { couponCode: null, source: null, percentOff: null, offerId: null };
    }
  }

  return {
    couponCode: bestOffer.coupon_code,
    source: 'offer',
    percentOff: bestOffer.percent_off ?? dbCoupon?.discount ?? null,
    offerId: bestOffer.id,
  };
}

export async function markUserOffersRedeemed(params: {
  prisma: PrismaClient;
  userId: number;
  offerKey?: OfferKey;
  reason?: string;
}): Promise<void> {
  const { prisma, userId, offerKey } = params;
  const where = {
    user_id: userId,
    redeemed_at: null as null,
    ...(offerKey ? { offer_key: offerKey } : {}),
  };

  try {
    await prisma.userOffer.updateMany({
      where,
      data: { redeemed_at: new Date() },
    });
  } catch (e) {
    log.debug('[OFFERS] markUserOffersRedeemed skipped', {
      userId,
      offerKey: offerKey ?? null,
      error: e instanceof Error ? e.message : e,
    });
  }
}

