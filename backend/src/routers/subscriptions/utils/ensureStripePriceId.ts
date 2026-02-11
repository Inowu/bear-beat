import { Plans, PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import stripeInstance from '../../../stripe';

export type StripePriceKey = 'stripe_prod_id' | 'stripe_prod_id_test';

type PlanForPriceResolution = Pick<
  Plans,
  'id' | 'name' | 'description' | 'moneda' | 'price' | 'duration' | StripePriceKey
>;

function parseDurationDays(duration: unknown): number | null {
  if (duration == null) return null;
  const raw = String(duration).trim();
  if (!raw) return null;
  const match = raw.match(/(\d{1,4})/);
  if (!match?.[1]) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function inferStripeRecurring(durationDays: number | null): {
  interval: 'day' | 'week' | 'month' | 'year';
  interval_count: number;
} {
  if (!durationDays) return { interval: 'month', interval_count: 1 };
  if (durationDays >= 360 && durationDays <= 370) {
    return { interval: 'year', interval_count: 1 };
  }
  if (durationDays >= 28 && durationDays <= 31) {
    return { interval: 'month', interval_count: 1 };
  }
  if (durationDays % 7 === 0) {
    const weeks = Math.floor(durationDays / 7);
    if (weeks >= 1 && weeks <= 52) return { interval: 'week', interval_count: weeks };
  }
  if (durationDays >= 1 && durationDays <= 365) {
    return { interval: 'day', interval_count: durationDays };
  }
  return { interval: 'month', interval_count: 1 };
}

function toCents(value: unknown): number {
  if (value == null) return 0;
  const raw =
    typeof value === 'string'
      ? value
      : typeof (value as any)?.toString === 'function'
        ? (value as any).toString()
        : String(value);
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

export function isStripePriceId(value: unknown): boolean {
  return typeof value === 'string' && value.startsWith('price_');
}

export async function ensureStripePriceId(opts: {
  prisma: PrismaClient;
  plan: PlanForPriceResolution;
  priceKey: StripePriceKey;
  stripe?: Stripe;
}): Promise<string> {
  const { prisma, plan, priceKey, stripe = stripeInstance } = opts;
  const current = (plan as any)?.[priceKey] as string | null | undefined;
  if (typeof current === 'string' && isStripePriceId(current)) return current;

  const currencyRaw = String(plan?.moneda || 'usd').trim().toLowerCase();
  const currency = /^[a-z]{3}$/.test(currencyRaw) ? currencyRaw : 'usd';
  const unitAmount = toCents(plan?.price);
  if (!unitAmount || unitAmount <= 0) {
    throw new Error('Invalid plan price');
  }

  const fallbackRecurring = inferStripeRecurring(parseDurationDays(plan?.duration));
  let recurring = fallbackRecurring;
  let productId: string | undefined;

  if (typeof current === 'string' && current.startsWith('prod_')) {
    productId = current;
  }

  if (typeof current === 'string' && current.startsWith('plan_')) {
    try {
      const legacyPlan = await stripe.plans.retrieve(current);
      productId =
        typeof legacyPlan.product === 'string'
          ? legacyPlan.product
          : legacyPlan.product?.id;

      const interval = legacyPlan.interval;
      if (
        interval === 'day' ||
        interval === 'week' ||
        interval === 'month' ||
        interval === 'year'
      ) {
        recurring = {
          interval,
          interval_count: legacyPlan.interval_count ?? 1,
        };
      }
    } catch {
      // Fallback to creating a fresh product + price below.
    }
  }

  if (!productId) {
    const product = await stripe.products.create(
      {
        name: String(plan?.name || `Plan ${plan?.id || ''}`).slice(0, 250),
        description: plan?.description ? String(plan.description).slice(0, 500) : undefined,
        metadata: { bb_plan_id: String(plan.id) },
      },
      { idempotencyKey: `bb-stripe-plan-${plan.id}-product-${priceKey}` },
    );
    productId = product.id;
  }

  const price = await stripe.prices.create(
    {
      currency,
      unit_amount: unitAmount,
      recurring,
      product: productId,
      metadata: { bb_plan_id: String(plan.id) },
    },
    {
      idempotencyKey: `bb-stripe-plan-${plan.id}-price-${priceKey}-${currency}-${unitAmount}-${recurring.interval}-${recurring.interval_count}`,
    },
  );

  await prisma.plans.update({
    where: { id: plan.id },
    data: { [priceKey]: price.id },
  });

  return price.id;
}
