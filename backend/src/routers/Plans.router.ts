import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import axios from 'axios';
import { shieldedProcedure } from '../procedures/shielded.procedure';
import { router } from '../trpc';
import type { Context } from '../context';
import { PlansAggregateSchema } from '../schemas/aggregatePlans.schema';
import { PlansCreateManySchema } from '../schemas/createManyPlans.schema';
import { PlansCreateOneSchema } from '../schemas/createOnePlans.schema';
import { PlansDeleteManySchema } from '../schemas/deleteManyPlans.schema';
import { PlansDeleteOneSchema } from '../schemas/deleteOnePlans.schema';
import { PlansFindFirstSchema } from '../schemas/findFirstPlans.schema';
import { PlansFindManySchema } from '../schemas/findManyPlans.schema';
import { PlansFindUniqueSchema } from '../schemas/findUniquePlans.schema';
import { PlansGroupBySchema } from '../schemas/groupByPlans.schema';
import { PlansUpdateManySchema } from '../schemas/updateManyPlans.schema';
import { PlansUpdateOneSchema } from '../schemas/updateOnePlans.schema';
import { PlansUpsertSchema } from '../schemas/upsertOnePlans.schema';
import stripeInstance from '../stripe';
import { log } from '../server';
import { getPlanKey } from '../utils/getPlanKey';
import { PaymentService } from './subscriptions/services/types';
import { OrderStatus } from './subscriptions/interfaces/order-status.interface';
import { paypal } from '../paypal';
import { manyChat } from '../many-chat';
import { getMarketingTrialConfigFromEnv } from '../utils/trialConfig';
import { StripePriceKey } from './subscriptions/utils/ensureStripePriceId';
import type { Plans } from '@prisma/client';
import { isStripeOxxoConfigured } from '../stripe/oxxo';
import { getPublicCatalogSummarySnapshot } from './Catalog.router';
import { getUserQuotaSnapshot } from './file-actions/quota';
import { createAdminAuditLog } from './utils/adminAuditLog';
import { RolesNames } from './auth/interfaces/roles.interface';

type StripeRecurringInterval = 'day' | 'week' | 'month' | 'year';

type CheckoutMethod = 'card' | 'paypal' | 'spei' | 'oxxo' | 'bbva';
type PaymentMethodBadge =
  | 'visa'
  | 'mastercard'
  | 'amex'
  | 'paypal'
  | 'spei'
  | 'oxxo'
  | 'transfer';

const CHECKOUT_METHOD_ORDER: CheckoutMethod[] = [
  'card',
  'paypal',
  'spei',
  'oxxo',
  'bbva',
];
const RECURRING_CONSENT_METHODS: CheckoutMethod[] = ['card', 'paypal'];
const TRIAL_ALLOWED_METHODS: CheckoutMethod[] = ['card'];

const FALLBACK_CATALOG_TOTAL_FILES = 248_321;
const FALLBACK_CATALOG_TOTAL_GB = 14_140;
const LIMITS_NOTE_COPY =
  'La cuota mensual es lo que puedes descargar cada ciclo. El catálogo total es lo disponible para elegir.';
const PRICING_BASE_PAYMENT_BADGES: PaymentMethodBadge[] = [
  'visa',
  'mastercard',
  'amex',
];
const PLANS_BASE_PAYMENT_BADGES: PaymentMethodBadge[] = ['visa', 'mastercard'];
const TRIAL_PAYMENT_BADGES: PaymentMethodBadge[] = [
  'visa',
  'mastercard',
  'amex',
];

type PricingCurrency = 'mxn' | 'usd';

function normalizePlanCurrency(value: unknown): PricingCurrency | null {
  const cur = String(value ?? '')
    .trim()
    .toLowerCase();
  if (cur === 'mxn') return 'mxn';
  if (cur === 'usd') return 'usd';
  return null;
}

function normalizeRecurringInterval(value: unknown): StripeRecurringInterval {
  if (
    value === 'day' ||
    value === 'week' ||
    value === 'month' ||
    value === 'year'
  )
    return value;
  return 'month';
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function hasValidStripePriceId(plan: Plans, stripeKey: keyof Plans): boolean {
  const stripeId = plan[stripeKey];
  return nonEmptyString(stripeId) && stripeId.startsWith('price_');
}

function hasPaypalPlanId(plan: Plans, paypalKey: keyof Plans): boolean {
  const paypalPlanId = plan[paypalKey];
  return nonEmptyString(paypalPlanId);
}

function pickBestCheckoutPlanCandidate(opts: {
  candidates: Plans[];
  stripeKey: keyof Plans;
  paypalKey: keyof Plans;
}): Plans | null {
  const { candidates, stripeKey, paypalKey } = opts;
  if (!Array.isArray(candidates) || candidates.length === 0) return null;

  let best: Plans | null = null;
  let bestScore = -1;
  for (const candidate of candidates) {
    if (!candidate) continue;
    let score = 0;
    if (hasValidStripePriceId(candidate, stripeKey)) score += 10;
    if (hasPaypalPlanId(candidate, paypalKey)) score += 2;
    // Prefer lower ids as a deterministic tie-breaker (legacy plans often have lower ids).
    score += -candidate.id / 10_000;

    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }

  return best;
}

function toFiniteNumber(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  const n = Number(value);
  if (Number.isFinite(n)) return n;
  const parsed = Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function pickDefaultCheckoutMethod(methods: CheckoutMethod[]): CheckoutMethod {
  if (methods.includes('card')) return 'card';
  return methods[0] ?? 'card';
}

function buildPaymentBadges(opts: {
  availableMethods: CheckoutMethod[];
  baseBadges: PaymentMethodBadge[];
}): PaymentMethodBadge[] {
  const methods = Array.isArray(opts.availableMethods)
    ? opts.availableMethods
    : [];
  const badges = new Set<PaymentMethodBadge>(opts.baseBadges);

  if (methods.includes('paypal')) badges.add('paypal');
  if (methods.includes('spei')) badges.add('spei');
  if (methods.includes('oxxo')) badges.add('oxxo');
  if (methods.includes('bbva')) badges.add('transfer');

  return Array.from(badges);
}

function buildAltPaymentLabel(methods: CheckoutMethod[]): string {
  const labels: string[] = [];
  if (methods.includes('paypal')) labels.push('PayPal');
  if (methods.includes('spei')) labels.push('SPEI');
  if (methods.includes('oxxo')) labels.push('Efectivo');
  if (methods.includes('bbva')) labels.push('Transferencia');
  return labels.join(' / ');
}

function formatMonthlyCurrencyHint(
  amount: number | null | undefined,
  currency: PricingCurrency,
): string {
  const fallback = currency === 'mxn' ? 350 : 18;
  const code = currency === 'mxn' ? 'MXN' : 'USD';
  const value = Number(amount ?? 0);
  const effective = Number.isFinite(value) && value > 0 ? value : fallback;
  const hasDecimals = Math.round(effective) !== effective;
  const formatted = hasDecimals ? effective.toFixed(2) : `${effective}`;
  return `${code} $${formatted}`;
}

function formatMonthlyDualHint(
  mxnAmount: number | null | undefined,
  usdAmount: number | null | undefined,
): string {
  const mxn = formatMonthlyCurrencyHint(mxnAmount, 'mxn');
  const usd = formatMonthlyCurrencyHint(usdAmount, 'usd');
  return `${mxn}/mes (${usd})`;
}

function toBigIntSafe(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value))
    return BigInt(Math.trunc(value));
  if (typeof value === 'string' && value.trim()) {
    try {
      return BigInt(value.trim());
    } catch {
      return BigInt(0);
    }
  }
  return BigInt(0);
}

async function resolveCurrentUserPlan(
  ctx: Pick<Context, 'prisma' | 'session'>,
): Promise<Plans | null> {
  const userId = ctx.session?.user?.id;
  if (!userId) return null;

  const sub = await ctx.prisma.descargasUser.findFirst({
    where: { user_id: userId },
    orderBy: { id: 'desc' },
  });
  if (!sub?.order_id) return null;

  const order = await ctx.prisma.orders.findFirst({
    where: { id: sub.order_id },
  });
  if (!order?.plan_id) return null;

  return ctx.prisma.plans.findFirst({
    where: { id: order.plan_id },
  });
}

async function resolveStripeProductAndRecurring(
  stripeIdentifier: string,
): Promise<{
  productId: string;
  recurring: { interval: StripeRecurringInterval; interval_count: number };
}> {
  if (stripeIdentifier.startsWith('price_')) {
    const price = await stripeInstance.prices.retrieve(stripeIdentifier);
    const productId =
      typeof price.product === 'string' ? price.product : price.product.id;
    return {
      productId,
      recurring: {
        interval: normalizeRecurringInterval(price.recurring?.interval),
        interval_count: price.recurring?.interval_count ?? 1,
      },
    };
  }

  if (stripeIdentifier.startsWith('plan_')) {
    const legacyPlan = await stripeInstance.plans.retrieve(stripeIdentifier);
    if (!legacyPlan.product) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No se pudo resolver el producto del plan de Stripe.',
      });
    }
    const productId =
      typeof legacyPlan.product === 'string'
        ? legacyPlan.product
        : legacyPlan.product.id;
    return {
      productId,
      recurring: {
        interval: normalizeRecurringInterval(legacyPlan.interval),
        interval_count: legacyPlan.interval_count ?? 1,
      },
    };
  }

  if (stripeIdentifier.startsWith('prod_')) {
    return {
      productId: stripeIdentifier,
      recurring: { interval: 'month', interval_count: 1 },
    };
  }

  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'El identificador de Stripe del plan es inválido.',
  });
}

async function computeTrialConfigForUser(
  ctx: Pick<Context, 'prisma' | 'session'>,
): Promise<{
  enabled: boolean;
  days: number;
  gb: number;
  eligible: boolean | null;
}> {
  const config = getMarketingTrialConfigFromEnv();

  // `eligible` is best-effort: null when unauthenticated / unknown.
  let eligible: boolean | null = null;
  const userId = ctx.session?.user?.id;
  if (userId) {
    const user = await ctx.prisma.users.findFirst({
      where: { id: userId },
      select: { trial_used_at: true, phone: true },
    });
    if (user) {
      if (!config.enabled || user.trial_used_at) {
        eligible = false;
      } else {
        const previousPaidPlanOrder = await ctx.prisma.orders.findFirst({
          where: {
            user_id: userId,
            status: OrderStatus.PAID,
            is_plan: 1,
          },
          select: { id: true },
        });
        eligible = !previousPaidPlanOrder;

        // Anti-abuse guard: if another account with the same phone already used a trial
        // or has a paid plan, treat this user as not eligible for a new "first time" trial.
        const phone = (user.phone ?? '').trim();
        if (eligible && phone) {
          try {
            const samePhoneUsers = await ctx.prisma.users.findMany({
              where: {
                id: { not: userId },
                phone,
              },
              select: { id: true, trial_used_at: true },
              take: 5,
            });

            const samePhoneHasTrial = samePhoneUsers.some((row) =>
              Boolean(row.trial_used_at),
            );
            let samePhoneHasPaid = false;
            if (!samePhoneHasTrial && samePhoneUsers.length > 0) {
              const paid = await ctx.prisma.orders.findFirst({
                where: {
                  user_id: { in: samePhoneUsers.map((row) => row.id) },
                  status: OrderStatus.PAID,
                  is_plan: 1,
                },
                select: { id: true },
              });
              samePhoneHasPaid = Boolean(paid);
            }

            if (samePhoneHasTrial || samePhoneHasPaid) {
              eligible = false;
            }
          } catch {
            // Best-effort only; do not break trial config computation.
          }
        }
      }
    }
  }

  return {
    enabled: config.enabled,
    days: config.days,
    gb: config.gb,
    eligible,
  };
}

export const plansRouter = router({
  getTrialConfig: shieldedProcedure.query(async ({ ctx }) =>
    computeTrialConfigForUser(ctx),
  ),
  getPublicPricingConfig: shieldedProcedure.query(async ({ ctx }) => {
    const stripeKey = getPlanKey(PaymentService.STRIPE);
    const paypalKey = getPlanKey(PaymentService.PAYPAL);

    // Production audits are READ-ONLY. When the auditor sets this header, avoid
    // triggering external side-effects (ManyChat tags/custom fields) from a query.
    const auditReadOnlyHeader = ctx.req?.headers?.['x-bb-audit-readonly'];
    const isPrivilegedRole =
      ctx.session?.user?.role != null &&
      ctx.session.user.role !== RolesNames.normal;
    const isAuditReadOnly = auditReadOnlyHeader === '1' || isPrivilegedRole;

    const [allPlans, trialConfig, catalogSummary] = await Promise.all([
      ctx.prisma.plans.findMany({
        where: {
          activated: 1,
          id: { not: 41 },
        },
        orderBy: { id: 'asc' },
      }),
      computeTrialConfigForUser(ctx),
      getPublicCatalogSummarySnapshot().catch(() => null),
    ]);

    const candidates = allPlans.filter((plan) => {
      const currency = normalizePlanCurrency(plan.moneda);
      if (!currency) return false;
      const price = toFiniteNumber(plan.price);
      const gigas = toFiniteNumber(plan.gigas);
      return price > 0 && gigas > 0;
    });

    const mxnBest = pickBestCheckoutPlanCandidate({
      candidates: candidates.filter(
        (plan) => normalizePlanCurrency(plan.moneda) === 'mxn',
      ),
      stripeKey,
      paypalKey,
    });
    const usdBest = pickBestCheckoutPlanCandidate({
      candidates: candidates.filter(
        (plan) => normalizePlanCurrency(plan.moneda) === 'usd',
      ),
      stripeKey,
      paypalKey,
    });

    if (!isAuditReadOnly && ctx.session?.user?.id) {
      try {
        const user = await ctx.prisma.users.findFirst({
          where: { id: ctx.session.user.id },
        });
        if (user) {
          manyChat.addTagToUser(user, 'USER_CHECKED_PLANS').catch(() => {});
        }
      } catch {
        // Best-effort only; do not break the query.
      }
    }

    const conektaAvailability = {
      // Conekta cash + BBVA pay-by-bank are currently hard-disabled in backend procedures.
      // Keep them hidden in the UI until those flows are re-enabled end-to-end.
      oxxoEnabled: isStripeOxxoConfigured(),
      payByBankEnabled: false,
    };

    const toPublic = (plan: Plans, currency: PricingCurrency) => {
      const hasPaypal = hasPaypalPlanId(plan, paypalKey);
      const currencyCode = currency === 'mxn' ? 'MXN' : 'USD';

      const availableMethodSet = new Set<CheckoutMethod>(['card']);
      if (hasPaypal) availableMethodSet.add('paypal');
      if (currencyCode === 'MXN') {
        availableMethodSet.add('spei');
        if (conektaAvailability.payByBankEnabled)
          availableMethodSet.add('bbva');
        if (conektaAvailability.oxxoEnabled) availableMethodSet.add('oxxo');
      }
      const availableMethods: CheckoutMethod[] = CHECKOUT_METHOD_ORDER.filter(
        (method) => availableMethodSet.has(method),
      );
      const pricingPaymentMethods = buildPaymentBadges({
        availableMethods,
        baseBadges: PRICING_BASE_PAYMENT_BADGES,
      });
      const plansPaymentMethods = buildPaymentBadges({
        availableMethods,
        baseBadges: PLANS_BASE_PAYMENT_BADGES,
      });
      const altPaymentLabel = buildAltPaymentLabel(availableMethods);

      const gigas = toFiniteNumber(plan.gigas);
      const quotaGb = gigas > 0 ? gigas : 500;

      return {
        planId: plan.id,
        currency,
        name: (plan.name ?? '').toString().trim() || 'Membresía Bear Beat',
        price: toFiniteNumber(plan.price),
        gigas,
        quotaGb,
        hasPaypal,
        availableMethods,
        paymentMethods: plansPaymentMethods,
        pricingPaymentMethods,
        trialPricingPaymentMethods: TRIAL_PAYMENT_BADGES,
        altPaymentLabel,
      };
    };

    const plans = {
      mxn: mxnBest ? toPublic(mxnBest, 'mxn') : null,
      usd: usdBest ? toPublic(usdBest, 'usd') : null,
    };

    const currencyDefault: PricingCurrency = plans.mxn
      ? 'mxn'
      : plans.usd
        ? 'usd'
        : 'mxn';

    const quotaGb = {
      mxn: plans.mxn?.quotaGb ?? plans.usd?.quotaGb ?? 500,
      usd: plans.usd?.quotaGb ?? plans.mxn?.quotaGb ?? 500,
    };

    const catalogHasLive = Boolean(
      catalogSummary &&
      !catalogSummary.error &&
      toFiniteNumber(catalogSummary.totalFiles) > 0 &&
      toFiniteNumber(catalogSummary.totalGB) > 0,
    );
    const effectiveTotalFiles = catalogHasLive
      ? toFiniteNumber(catalogSummary?.totalFiles)
      : FALLBACK_CATALOG_TOTAL_FILES;
    const effectiveTotalGB = catalogHasLive
      ? toFiniteNumber(catalogSummary?.totalGB)
      : FALLBACK_CATALOG_TOTAL_GB;
    const effectiveTotalTB = effectiveTotalGB / 1000;
    const afterPriceLabel = formatMonthlyDualHint(
      plans.mxn?.price,
      plans.usd?.price,
    );

    return {
      generatedAt: new Date().toISOString(),
      currencyDefault,
      ui: {
        defaultCurrency: currencyDefault,
        limitsNote: LIMITS_NOTE_COPY,
        afterPriceLabel,
        stats: {
          totalFiles: effectiveTotalFiles,
          totalGB: effectiveTotalGB,
          totalTB: effectiveTotalTB,
          quotaGb,
          quotaGbDefault: quotaGb[currencyDefault],
        },
      },
      conektaAvailability,
      quotaGb,
      trialConfig,
      plans,
      catalog: {
        ...(catalogSummary ?? {
          error: 'No se pudo obtener el resumen del catálogo.',
          totalFiles: 0,
          totalGB: 0,
          videos: 0,
          audios: 0,
          karaokes: 0,
          other: 0,
          gbVideos: 0,
          gbAudios: 0,
          gbKaraokes: 0,
          totalGenres: 0,
          genresDetail: [],
          generatedAt: new Date().toISOString(),
          stale: true,
        }),
        effectiveTotalFiles,
        effectiveTotalGB,
        effectiveTotalTB,
        isFallback: !catalogHasLive,
      },
    };
  }),
  getUpgradeOptions: shieldedProcedure.query(async ({ ctx }) => {
    const userId = ctx.session?.user?.id;
    const currentPlan = await resolveCurrentUserPlan(ctx);

    if (!currentPlan || !userId) {
      return {
        currentPlan: null,
        upgradePlans: [],
        quotaUsedGb: 0,
        billingRail: 'unknown' as const,
      };
    }

    const quota = await getUserQuotaSnapshot({ prisma: ctx.prisma, userId });
    const usedBytes = toBigIntSafe(quota?.regular?.used);
    const quotaUsedGbBigInt = usedBytes / BigInt(1_000_000_000);

    const stripeCandidate = String(
      currentPlan.stripe_prod_id ?? currentPlan.stripe_prod_id_test ?? '',
    ).trim();
    const paypalProductId = String(currentPlan.paypal_product_id ?? '').trim();
    const currency = String(currentPlan.moneda ?? '').trim();

    const baseWhere: Record<string, unknown> = {
      activated: 1,
      NOT: {
        id: currentPlan.id,
      },
    };
    if (currency) {
      baseWhere.moneda = currency;
    }

    let billingRail: 'stripe' | 'paypal' | 'unknown' = 'unknown';
    let plans: Plans[] = [];

    if (stripeCandidate) {
      billingRail = 'stripe';
      plans = await ctx.prisma.plans.findMany({
        where: {
          ...baseWhere,
          paypal_plan_id: null,
        },
        orderBy: { id: 'asc' },
      });
    } else if (paypalProductId) {
      billingRail = 'paypal';
      const candidates = await ctx.prisma.plans.findMany({
        where: {
          ...baseWhere,
          stripe_prod_id: null,
        },
        orderBy: { id: 'asc' },
      });

      plans = candidates.filter(
        (plan) =>
          String(plan.paypal_product_id ?? '').trim() === paypalProductId,
      );
    } else {
      plans = await ctx.prisma.plans.findMany({
        where: baseWhere,
        orderBy: { id: 'asc' },
      });
    }

    const upgradePlans = plans
      .filter((plan) => toBigIntSafe(plan?.gigas) > quotaUsedGbBigInt)
      .sort((a, b) => {
        const byQuota = toFiniteNumber(a.gigas) - toFiniteNumber(b.gigas);
        if (byQuota !== 0) return byQuota;
        return a.id - b.id;
      });

    return {
      currentPlan,
      upgradePlans,
      quotaUsedGb: Number(quotaUsedGbBigInt),
      billingRail,
    };
  }),
  resolveCheckoutPlan: shieldedProcedure
    .input(
      z.object({
        planId: z.number().int().positive(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const requestedPlanId = input.planId;
      const stripeKey = getPlanKey(PaymentService.STRIPE);
      const paypalKey = getPlanKey(PaymentService.PAYPAL);

      // Production audits are READ-ONLY. When the auditor sets this header, avoid
      // triggering external side-effects (ManyChat tags/custom fields) from a query.
      const auditReadOnlyHeader = ctx.req?.headers?.['x-bb-audit-readonly'];
      const isPrivilegedRole =
        ctx.session?.user?.role != null &&
        ctx.session.user.role !== RolesNames.normal;
      const isAuditReadOnly = auditReadOnlyHeader === '1' || isPrivilegedRole;

      const requestedPlan = await ctx.prisma.plans.findFirst({
        where: {
          activated: 1,
          id: requestedPlanId,
        },
      });

      if (!requestedPlan) {
        return {
          requestedPlanId,
          resolvedPlanId: null,
          plan: null,
          paypalPlan: null,
          checkout: null,
        };
      }

      let resolvedPlan = requestedPlan;

      // Conversion hardening: legacy plan ids may be linked from ads/bookmarks.
      // If the requested plan lacks a Stripe Price ID (price_*), auto-switch to a sibling
      // with the same name/price/currency that has a valid Stripe Price configured.
      if (!hasValidStripePriceId(requestedPlan, stripeKey)) {
        const siblings = await ctx.prisma.plans.findMany({
          where: {
            activated: 1,
            name: requestedPlan.name,
            moneda: requestedPlan.moneda,
            price: requestedPlan.price,
          },
          orderBy: { id: 'asc' },
        });

        const best = pickBestCheckoutPlanCandidate({
          candidates: siblings,
          stripeKey,
          paypalKey,
        });
        if (best) resolvedPlan = best;
      }

      let paypalPlan: Plans | null = null;
      if (hasPaypalPlanId(resolvedPlan, paypalKey)) {
        paypalPlan = resolvedPlan;
      } else {
        // PayPal can be configured on a sibling plan with the same currency/price.
        // Prefer exact name matches, but fall back to currency/price matches for legacy data.
        const paypalSiblingsByName = await ctx.prisma.plans.findMany({
          where: {
            activated: 1,
            name: resolvedPlan.name,
            moneda: resolvedPlan.moneda,
            price: resolvedPlan.price,
          },
          orderBy: { id: 'asc' },
        });

        let paypalCandidates = paypalSiblingsByName.filter((row) =>
          hasPaypalPlanId(row, paypalKey),
        );
        if (paypalCandidates.length === 0) {
          const paypalSiblings = await ctx.prisma.plans.findMany({
            where: {
              activated: 1,
              moneda: resolvedPlan.moneda,
              price: resolvedPlan.price,
            },
            orderBy: { id: 'asc' },
          });
          paypalCandidates = paypalSiblings.filter((row) =>
            hasPaypalPlanId(row, paypalKey),
          );
        }

        paypalPlan = pickBestCheckoutPlanCandidate({
          candidates: paypalCandidates,
          stripeKey,
          paypalKey,
        });
      }

      // Marketing attribution: mirror legacy behavior from `findManyPlans` so checkout links
      // still tag the logged-in user with the last plan they tried to buy.
      if (!isAuditReadOnly && ctx.session?.user?.id) {
        try {
          const user = await ctx.prisma.users.findFirst({
            where: { id: ctx.session.user.id },
          });
          if (user) {
            const name = (resolvedPlan?.name ?? '').toString();
            if (name.includes('Oro')) {
              manyChat.addTagToUser(user, 'CHECKOUT_PLAN_ORO').catch(() => {});
            } else if (name.includes('Curioso')) {
              manyChat
                .addTagToUser(user, 'CHECKOUT_PLAN_CURIOSO')
                .catch(() => {});
            }

            let mcId: string | null = null;
            try {
              mcId = await manyChat.getManyChatId(user);
            } catch {
              mcId = null;
            }

            if (mcId) {
              manyChat
                .setCustomField(mcId, 'ultimo_plan_checkout', name)
                .catch(() => {});
              manyChat
                .setCustomField(
                  mcId,
                  'ultimo_precio_checkout',
                  String(resolvedPlan.price ?? ''),
                )
                .catch(() => {});
            }
          }
        } catch {
          // Best-effort only; do not break checkout plan resolution query.
        }
      }

      const currencyCode = String(resolvedPlan.moneda ?? '')
        .trim()
        .toUpperCase();
      const conektaAvailability = {
        // Conekta cash + BBVA pay-by-bank are currently hard-disabled in backend procedures.
        // Keep them hidden in the UI until those flows are re-enabled end-to-end.
        oxxoEnabled: isStripeOxxoConfigured(),
        payByBankEnabled: false,
      };
      const availableMethodSet = new Set<CheckoutMethod>(['card']);
      if (paypalPlan) availableMethodSet.add('paypal');
      if (currencyCode === 'MXN') {
        availableMethodSet.add('spei');
        if (conektaAvailability.payByBankEnabled)
          availableMethodSet.add('bbva');
        if (conektaAvailability.oxxoEnabled) availableMethodSet.add('oxxo');
      }
      const methods: CheckoutMethod[] = CHECKOUT_METHOD_ORDER.filter((method) =>
        availableMethodSet.has(method),
      );
      const defaultMethod = pickDefaultCheckoutMethod(methods);
      const recurringConsentMethods = RECURRING_CONSENT_METHODS.filter(
        (method) => availableMethodSet.has(method),
      );
      const trialAllowedMethods = TRIAL_ALLOWED_METHODS.filter((method) =>
        availableMethodSet.has(method),
      );

      const trialConfig = await computeTrialConfigForUser(ctx);
      const quotaGbRaw = toFiniteNumber(resolvedPlan.gigas);
      const quotaGb = quotaGbRaw > 0 ? quotaGbRaw : 500;
      const planDisplayName =
        (resolvedPlan.name ?? '').toString().trim() || 'Membresía Bear Beat';

      return {
        requestedPlanId,
        resolvedPlanId: resolvedPlan.id,
        plan: resolvedPlan,
        paypalPlan,
        checkout: {
          currency: currencyCode || 'USD',
          price: toFiniteNumber(resolvedPlan.price),
          availableMethods: methods,
          defaultMethod,
          trialConfig,
          conektaAvailability,
          planDisplayName,
          quotaGb,
          requiresRecurringConsentMethods: recurringConsentMethods,
          trialAllowedMethods,
        },
      };
    }),
  getPublicBestPlans: shieldedProcedure.query(async ({ ctx }) => {
    const stripeKey = getPlanKey(PaymentService.STRIPE);
    const paypalKey = getPlanKey(PaymentService.PAYPAL);

    // Production audits are READ-ONLY. When the auditor sets this header, avoid
    // triggering external side-effects (ManyChat tags/custom fields) from a query.
    const auditReadOnlyHeader = ctx.req?.headers?.['x-bb-audit-readonly'];
    const isPrivilegedRole =
      ctx.session?.user?.role != null &&
      ctx.session.user.role !== RolesNames.normal;
    const isAuditReadOnly = auditReadOnlyHeader === '1' || isPrivilegedRole;

    const allPlans = await ctx.prisma.plans.findMany({
      where: {
        activated: 1,
        id: { not: 41 },
      },
      orderBy: { id: 'asc' },
    });

    const candidates = allPlans.filter((plan) => {
      const currency = normalizePlanCurrency(plan.moneda);
      if (!currency) return false;
      const price = toFiniteNumber(plan.price);
      const gigas = toFiniteNumber(plan.gigas);
      return price > 0 && gigas > 0;
    });

    const mxnBest = pickBestCheckoutPlanCandidate({
      candidates: candidates.filter(
        (plan) => normalizePlanCurrency(plan.moneda) === 'mxn',
      ),
      stripeKey,
      paypalKey,
    });
    const usdBest = pickBestCheckoutPlanCandidate({
      candidates: candidates.filter(
        (plan) => normalizePlanCurrency(plan.moneda) === 'usd',
      ),
      stripeKey,
      paypalKey,
    });

    if (!isAuditReadOnly && ctx.session?.user?.id) {
      try {
        const user = await ctx.prisma.users.findFirst({
          where: { id: ctx.session.user.id },
        });
        if (user) {
          manyChat.addTagToUser(user, 'USER_CHECKED_PLANS').catch(() => {});
        }
      } catch {
        // Best-effort only; do not break the query.
      }
    }

    const toPublic = (plan: Plans, currency: 'mxn' | 'usd') => ({
      planId: plan.id,
      currency,
      name: (plan.name ?? '').toString().trim() || 'Membresía Bear Beat',
      price: toFiniteNumber(plan.price),
      gigas: toFiniteNumber(plan.gigas),
      hasPaypal: hasPaypalPlanId(plan, paypalKey),
    });

    return {
      mxn: mxnBest ? toPublic(mxnBest, 'mxn') : null,
      usd: usdBest ? toPublic(usdBest, 'usd') : null,
    };
  }),
  createStripePlan: shieldedProcedure
    .input(
      z.intersection(
        PlansCreateOneSchema,
        z.object({
          interval: z.union([z.literal('month'), z.literal('year')]).optional(),
        }),
      ),
    )
    .mutation(
      async ({ ctx: { prisma, session, req }, input: { data, interval } }) => {
        try {
          const priceKey = getPlanKey(PaymentService.STRIPE) as StripePriceKey;
          const recurringInterval = normalizeRecurringInterval(
            interval?.toLowerCase(),
          );
          const currency = (data.moneda?.toLowerCase() || 'usd').trim();
          const unitAmount = Math.round(Number(data.price) * 100);

          if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'El precio del plan debe ser mayor a cero',
            });
          }

          const stripeProduct = await stripeInstance.products.create({
            name: data.name,
            active: data.activated == null ? true : Boolean(data.activated),
            description: data.description,
          });

          const stripePrice = await stripeInstance.prices.create({
            product: stripeProduct.id,
            currency,
            unit_amount: unitAmount,
            recurring: {
              interval: recurringInterval,
              interval_count: 1,
            },
          });

          const prismaPlan = await prisma.plans.create({
            data: {
              ...data,
              [priceKey]: stripePrice.id,
            },
          });

          const actorUserId = session?.user?.id;
          if (actorUserId) {
            await createAdminAuditLog({
              prisma,
              req,
              actorUserId,
              action: 'create_plan_stripe',
              metadata: {
                planId: prismaPlan.id,
                currency,
                interval: recurringInterval,
              },
            });
          }

          return prismaPlan;
        } catch (e) {
          log.error(
            `[PLANS:CREATE_STRIPE_PLAN] An error ocurred while creating a stripe plan: ${JSON.stringify(
              e,
            )}`,
          );

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Ocurrió un error al crear el plan de stripe',
          });
        }
      },
    ),
  updateStripePlan: shieldedProcedure
    .input(PlansUpdateOneSchema)
    .mutation(async ({ ctx: { prisma, session, req }, input }) => {
      const { where, data } = input;

      const plan = await prisma.plans.findUnique({
        where,
      });

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plan no encontrado',
        });
      }

      const stripeId = plan[getPlanKey(PaymentService.STRIPE)];

      if (!stripeId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'El plan no tiene un id de stripe asociado',
        });
      }

      try {
        const priceKey = getPlanKey(PaymentService.STRIPE) as StripePriceKey;
        const stripeIdentifier = plan[priceKey] as string;
        const { productId, recurring } =
          await resolveStripeProductAndRecurring(stripeIdentifier);

        const productUpdate: Record<string, unknown> = {};
        if (data.name !== undefined) productUpdate.name = data.name as string;
        if (data.activated !== undefined)
          productUpdate.active = Boolean(data.activated);
        if (data.description !== undefined) {
          productUpdate.description = (data.description as string) || '';
        }

        if (Object.keys(productUpdate).length > 0) {
          await stripeInstance.products.update(productId, productUpdate);
        }

        const shouldCreateNewPrice =
          data.price !== undefined ||
          data.moneda !== undefined ||
          !stripeIdentifier.startsWith('price_');

        let replacementPriceId: string | null = null;
        if (shouldCreateNewPrice) {
          const unitAmount = Math.round(
            Number((data.price as any) ?? plan.price) * 100,
          );
          if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'El precio del plan debe ser mayor a cero',
            });
          }

          const currencyRaw = String(
            (data.moneda as any) ?? plan.moneda ?? 'usd',
          )
            .trim()
            .toLowerCase();
          const currency = /^[a-z]{3}$/.test(currencyRaw) ? currencyRaw : 'usd';

          const replacementPrice = await stripeInstance.prices.create({
            product: productId,
            currency,
            unit_amount: unitAmount,
            recurring,
          });
          replacementPriceId = replacementPrice.id;
        }

        const prismaPlan = await prisma.plans.update({
          where,
          data: {
            ...(data as Record<string, unknown>),
            ...(replacementPriceId ? { [priceKey]: replacementPriceId } : {}),
          },
        });

        const actorUserId = session?.user?.id;
        if (actorUserId) {
          await createAdminAuditLog({
            prisma,
            req,
            actorUserId,
            action: 'update_plan_stripe',
            metadata: {
              planId: prismaPlan.id,
              replacementPriceId,
              updatedFields: Object.keys(data as Record<string, unknown>),
            },
          });
        }

        return prismaPlan;
      } catch (e) {
        log.error(
          `[PLANS:CREATE_STRIPE_PLAN] An error ocurred while creating a stripe plan: ${JSON.stringify(
            e,
          )}`,
        );

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Ocurrió un error al crear el plan de stripe',
        });
      }
    }),
  deleteStripePlan: shieldedProcedure
    .input(PlansDeleteOneSchema)
    .mutation(async ({ ctx: { prisma, session, req }, input }) => {
      const { where } = input;

      const plan = await prisma.plans.findUnique({
        where,
      });

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plan no encontrado',
        });
      }

      const stripeId = plan[getPlanKey(PaymentService.STRIPE)];

      if (!stripeId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'El plan no tiene un id de stripe asociado',
        });
      }

      try {
        const priceKey = getPlanKey(PaymentService.STRIPE) as StripePriceKey;
        const stripeIdentifier = plan[priceKey] as string;
        const { productId } =
          await resolveStripeProductAndRecurring(stripeIdentifier);

        await stripeInstance.products.update(productId, { active: false });

        const prismaPlan = await prisma.plans.update({
          where,
          data: {
            [priceKey]: null,
          },
        });

        const actorUserId = session?.user?.id;
        if (actorUserId) {
          await createAdminAuditLog({
            prisma,
            req,
            actorUserId,
            action: 'delete_plan_stripe',
            metadata: {
              planId: prismaPlan.id,
              stripeId: stripeIdentifier,
            },
          });
        }

        return prismaPlan;
      } catch (e) {
        log.error(
          `[PLANS:CREATE_STRIPE_PLAN] An error ocurred while creating a stripe plan: ${JSON.stringify(
            e,
          )}`,
        );

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Ocurrió un error al crear el plan de stripe',
        });
      }
    }),
  createPaypalPlan: shieldedProcedure
    .input(
      z.intersection(
        PlansUpdateOneSchema,
        z.object({
          interval: z.union([z.literal('month'), z.literal('year')]).optional(),
        }),
      ),
    )
    .mutation(
      async ({
        ctx: { prisma, session, req },
        input: { data, where, interval },
      }) => {
        try {
          const token = await paypal.getToken();

          const planWithProduct = await prisma.plans.findFirst({
            where: {
              NOT: [
                {
                  paypal_product_id: null,
                },
              ],
            },
          });

          let paypalProductId = planWithProduct?.paypal_product_id;
          if (!paypalProductId) {
            const productResponse = (
              await axios.post(
                `${paypal.paypalUrl()}/v1/catalogs/products`,
                {
                  name: data.name,
                  description: data.description || 'Bear Beat subscription',
                  type: 'SERVICE',
                  category: 'SOFTWARE',
                },
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                  },
                },
              )
            ).data;

            paypalProductId = productResponse.id as string;
          }

          const planResponse = (
            await axios.post(
              `${paypal.paypalUrl()}/v1/billing/plans`,
              {
                product_id: paypalProductId,
                name: data.name,
                description: data.description,
                status: 'ACTIVE',
                billing_cycles: [
                  {
                    tenure_type: 'REGULAR',
                    sequence: 1,
                    total_cycles: 0,
                    pricing_scheme: {
                      fixed_price: {
                        value: data.price,
                        currency_code:
                          (data.moneda as string)?.toUpperCase() || 'USD',
                      },
                    },
                    frequency: {
                      interval_unit: interval?.toUpperCase() || 'MONTH',
                      interval_count: 1,
                    },
                  },
                ],
                payment_preferences: {
                  auto_bill_outstanding: true,
                  setup_fee: {
                    value: '0',
                    currency_code:
                      (data.moneda as string)?.toUpperCase() || 'USD',
                  },
                },
              },
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              },
            )
          ).data;

          const prismaPlan = await prisma.plans.create({
            data: {
              ...(data as any),
              paypal_product_id: paypalProductId,
              [getPlanKey(PaymentService.PAYPAL)]: planResponse.id,
            },
          });

          const actorUserId = session?.user?.id;
          if (actorUserId) {
            await createAdminAuditLog({
              prisma,
              req,
              actorUserId,
              action: 'create_plan_paypal',
              metadata: {
                planId: prismaPlan.id,
                paypalPlanId: planResponse.id,
                sourcePlanId: where.id ?? null,
              },
            });
          }

          return prismaPlan;
        } catch (e) {
          log.error(
            `[PLANS:CREATE_PAYPAL_PLAN] An error ocurred while creating a paypal plan: ${JSON.stringify(
              e,
            )}`,
          );

          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Ocurrió un error al crear el plan de paypal',
          });
        }
      },
    ),
  deactivatePaypalPlan: shieldedProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .mutation(async ({ ctx: { prisma, session, req }, input: { id } }) => {
      const plan = await prisma.plans.findUnique({
        where: {
          id,
        },
      });

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plan no encontrado',
        });
      }

      try {
        const token = await paypal.getToken();
        const paypalPlanKey = getPlanKey(PaymentService.PAYPAL);
        const paypalPlanId = plan[paypalPlanKey];
        if (!paypalPlanId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'El plan no tiene un id de PayPal asociado',
          });
        }

        await axios.post(
          `${paypal.paypalUrl()}/v1/billing/plans/${paypalPlanId}/deactivate`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        const updatedPlan = await prisma.plans.update({
          where: { id: plan.id },
          data: {
            [paypalPlanKey]: null,
          },
        });

        const actorUserId = session?.user?.id;
        if (actorUserId) {
          await createAdminAuditLog({
            prisma,
            req,
            actorUserId,
            action: 'deactivate_plan_paypal',
            metadata: {
              planId: updatedPlan.id,
              paypalPlanId,
            },
          });
        }

        return updatedPlan;
      } catch (e) {
        log.error(
          `[PLANS:CREATE_PAYPAL_PLAN] An error ocurred while creating a paypal plan: ${JSON.stringify(
            e,
          )}`,
        );

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Ocurrió un error al crear el plan de paypal',
        });
      }
    }),
  aggregatePlans: shieldedProcedure
    .input(PlansAggregateSchema)
    .query(async ({ ctx, input }) => {
      const aggregatePlans = await ctx.prisma.plans.aggregate(input);
      return aggregatePlans;
    }),
  createManyPlans: shieldedProcedure
    .input(PlansCreateManySchema)
    .mutation(async ({ ctx, input }) => {
      const createManyPlans = await ctx.prisma.plans.createMany(input);
      return createManyPlans;
    }),
  createOnePlans: shieldedProcedure
    .input(PlansCreateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const createOnePlans = await ctx.prisma.plans.create(input);
      return createOnePlans;
    }),
  deleteManyPlans: shieldedProcedure
    .input(PlansDeleteManySchema)
    .mutation(async ({ ctx, input }) => {
      const deleteManyPlans = await ctx.prisma.plans.deleteMany(input);
      return deleteManyPlans;
    }),
  deleteOnePlans: shieldedProcedure
    .input(PlansDeleteOneSchema)
    .mutation(async ({ ctx, input }) => {
      const deleteOnePlans = await ctx.prisma.plans.delete(input);
      return deleteOnePlans;
    }),
  findFirstPlans: shieldedProcedure
    .input(PlansFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstPlans = await ctx.prisma.plans.findFirst(input);
      return findFirstPlans;
    }),
  findFirstPlansOrThrow: shieldedProcedure
    .input(PlansFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstPlansOrThrow =
        await ctx.prisma.plans.findFirstOrThrow(input);
      return findFirstPlansOrThrow;
    }),
  findManyPlans: shieldedProcedure
    .input(PlansFindManySchema)
    .query(async ({ ctx, input }) => {
      const plans = await ctx.prisma.plans.findMany(input);
      // Production audits are READ-ONLY. When the auditor sets this header, avoid
      // triggering external side-effects (ManyChat tags/custom fields) from a query.
      const auditReadOnlyHeader = ctx.req?.headers?.['x-bb-audit-readonly'];
      const isPrivilegedRole =
        ctx.session?.user?.role != null &&
        ctx.session.user.role !== RolesNames.normal;
      const isAuditReadOnly = auditReadOnlyHeader === '1' || isPrivilegedRole;

      if (!isAuditReadOnly && ctx.session?.user?.id && plans.length > 0) {
        try {
          const user = await ctx.prisma.users.findFirst({
            where: { id: ctx.session.user.id },
          });
          if (user) {
            const whereAny = input.where as Record<string, unknown> | undefined;
            const hasSinglePlanId =
              whereAny?.id !== undefined && plans.length === 1;
            if (hasSinglePlanId) {
              const plan = plans[0];
              const name = (plan?.name ?? '').toString();
              if (name.includes('Oro')) {
                void manyChat
                  .addTagToUser(user, 'CHECKOUT_PLAN_ORO')
                  .catch(() => {});
              } else if (name.includes('Curioso')) {
                void manyChat
                  .addTagToUser(user, 'CHECKOUT_PLAN_CURIOSO')
                  .catch(() => {});
              }

              // Do not block the query result on ManyChat (network) calls.
              void manyChat
                .getManyChatId(user)
                .then((mcId) => {
                  if (!mcId || !plan) return;
                  void manyChat
                    .setCustomField(mcId, 'ultimo_plan_checkout', name)
                    .catch(() => {});
                  void manyChat
                    .setCustomField(
                      mcId,
                      'ultimo_precio_checkout',
                      String(plan.price ?? ''),
                    )
                    .catch(() => {});
                })
                .catch(() => {});
            } else {
              void manyChat
                .addTagToUser(user, 'USER_CHECKED_PLANS')
                .catch(() => {});
            }
          }
        } catch {
          // Best-effort only; do not break plan listing on tracking failures.
        }
      }
      return plans;
    }),
  findUniquePlans: shieldedProcedure
    .input(PlansFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniquePlans = await ctx.prisma.plans.findUnique(input);
      return findUniquePlans;
    }),
  findUniquePlansOrThrow: shieldedProcedure
    .input(PlansFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniquePlansOrThrow =
        await ctx.prisma.plans.findUniqueOrThrow(input);
      return findUniquePlansOrThrow;
    }),
  groupByPlans: shieldedProcedure
    .input(PlansGroupBySchema)
    .query(async ({ ctx, input }) => {
      const groupByPlans = await ctx.prisma.plans.groupBy({
        where: input.where,
        orderBy: input.orderBy,
        by: input.by,
        having: input.having,
        take: input.take,
        skip: input.skip,
      });
      return groupByPlans;
    }),
  updateManyPlans: shieldedProcedure
    .input(PlansUpdateManySchema)
    .mutation(async ({ ctx, input }) => {
      const updateManyPlans = await ctx.prisma.plans.updateMany(input);
      return updateManyPlans;
    }),
  updateOnePlans: shieldedProcedure
    .input(PlansUpdateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const updateOnePlans = await ctx.prisma.plans.update(input);
      return updateOnePlans;
    }),
  upsertOnePlans: shieldedProcedure
    .input(PlansUpsertSchema)
    .mutation(async ({ ctx, input }) => {
      const upsertOnePlans = await ctx.prisma.plans.upsert(input);
      return upsertOnePlans;
    }),
});
