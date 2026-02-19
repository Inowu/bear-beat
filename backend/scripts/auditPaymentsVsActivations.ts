import './_loadEnv';

import { PrismaClient } from '@prisma/client';
import { OrderStatus } from '../src/routers/subscriptions/interfaces/order-status.interface';
import { log } from '../src/server';

type AuditProvider = 'stripe' | 'stripe_oxxo' | 'paypal' | 'conekta' | 'admin';
type ActivationClass = 'linked' | 'probable_unlinked' | 'weak_unlinked' | 'missing';

interface PaidPlanOrder {
  id: number;
  userId: number;
  paymentMethod: string | null;
  planId: number | null;
  dateOrder: Date;
}

interface DescargasRow {
  orderId: number | null;
  userId: number;
  dateEnd: Date;
}

interface ProviderSummary {
  paidOrders: number;
  linkedActivation: number;
  probableUnlinkedActivation: number;
  weakUnlinkedActivation: number;
  missingActivation: number;
  duplicateLinkedRows: number;
  linkedCoveragePct: number;
  coverageIncludingProbablePct: number;
}

interface AuditReport {
  generatedAt: string;
  range: {
    since: string;
    untilExclusive: string;
    untilHuman: string;
    timezone: 'UTC';
  };
  providers: Record<AuditProvider, ProviderSummary>;
  totals: ProviderSummary;
  samples: {
    maxPerProvider: number;
    missingOrderIdsByProvider: Record<AuditProvider, number[]>;
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_DAYS = 31;
const DEFAULT_SAMPLE = 50;
const DEFAULT_PROVIDERS = 'stripe,stripe_oxxo,paypal,conekta';
const ALL_PROVIDERS: AuditProvider[] = [
  'stripe',
  'stripe_oxxo',
  'paypal',
  'conekta',
  'admin',
];

const hasFlag = (args: string[], flag: string): boolean => args.includes(flag);

const getFlagValue = (args: string[], flag: string): string | null => {
  const idx = args.indexOf(flag);
  if (idx < 0 || idx + 1 >= args.length) return null;
  const value = args[idx + 1];
  if (!value || value.startsWith('--')) return null;
  return value.trim();
};

const parsePositiveInt = (raw: string | null, fallback: number): number => {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const rounded = Math.floor(parsed);
  return rounded > 0 ? rounded : fallback;
};

const parseDate = (
  raw: string | null,
  opts: {
    isUntil: boolean;
  },
): Date | null => {
  if (!raw) return null;
  const value = raw.trim();
  if (!value) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime())) return null;
    if (opts.isUntil) {
      return new Date(parsed.getTime() + DAY_MS);
    }
    return parsed;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const startOfUtcDay = (date: Date): Date =>
  new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    0,
    0,
    0,
    0,
  ));

const addUtcDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + (days * DAY_MS));

const roundPct = (value: number): number =>
  Math.round(value * 100) / 100;

const calcPct = (part: number, total: number): number => {
  if (total <= 0) return 0;
  return roundPct((part / total) * 100);
};

const toDurationDays = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 30;
  const rounded = Math.floor(parsed);
  return rounded > 0 ? rounded : 30;
};

const resolveProvider = (paymentMethod: string | null): AuditProvider | null => {
  const normalized = String(paymentMethod || '').toLowerCase();
  if (!normalized) return null;
  if (normalized.includes('stripe') && normalized.includes('oxxo')) return 'stripe_oxxo';
  if (normalized.includes('stripe')) return 'stripe';
  if (normalized.includes('paypal')) return 'paypal';
  if (normalized.includes('conekta')) return 'conekta';
  if (normalized.includes('admin')) return 'admin';
  return null;
};

const parseProviders = (raw: string | null): Set<AuditProvider> => {
  const source = (raw || DEFAULT_PROVIDERS).trim().toLowerCase();
  if (!source) return new Set<AuditProvider>(['stripe', 'stripe_oxxo', 'paypal', 'conekta']);

  const tokens = source.split(',').map((item) => item.trim()).filter(Boolean);
  const selected = new Set<AuditProvider>();
  for (const token of tokens) {
    if (token === 'all') {
      ALL_PROVIDERS.forEach((provider) => selected.add(provider));
      continue;
    }
    if ((ALL_PROVIDERS as string[]).includes(token)) {
      selected.add(token as AuditProvider);
      continue;
    }
    throw new Error(
      `Unsupported provider "${token}". Allowed: ${[...ALL_PROVIDERS, 'all'].join(', ')}`,
    );
  }
  return selected;
};

const emptySummary = (): ProviderSummary => ({
  paidOrders: 0,
  linkedActivation: 0,
  probableUnlinkedActivation: 0,
  weakUnlinkedActivation: 0,
  missingActivation: 0,
  duplicateLinkedRows: 0,
  linkedCoveragePct: 0,
  coverageIncludingProbablePct: 0,
});

const classifyActivation = (
  order: PaidPlanOrder,
  opts: {
    linkedRowsCount: number;
    userRows: DescargasRow[];
    durationDays: number;
  },
): ActivationClass => {
  if (opts.linkedRowsCount > 0) return 'linked';

  const orderDay = startOfUtcDay(order.dateOrder);
  const minExpectedEnd = addUtcDays(orderDay, Math.max(1, Math.floor(opts.durationDays * 0.7)));

  const hasStrongCoverage = opts.userRows.some((row) => row.dateEnd >= minExpectedEnd);
  if (hasStrongCoverage) return 'probable_unlinked';

  const hasWeakCoverage = opts.userRows.some((row) => row.dateEnd >= orderDay);
  if (hasWeakCoverage) return 'weak_unlinked';

  return 'missing';
};

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    log.warn('[PAYMENTS_ACTIVATION_AUDIT] DATABASE_URL not configured. Skipping.');
    return;
  }

  const args = process.argv.slice(2);
  const days = Math.max(1, Math.min(3650, parsePositiveInt(getFlagValue(args, '--days'), DEFAULT_DAYS)));
  const sinceFlagRaw = getFlagValue(args, '--since');
  const untilFlagRaw = getFlagValue(args, '--until');
  const sinceDate = parseDate(sinceFlagRaw, { isUntil: false });
  const untilDate = parseDate(untilFlagRaw, { isUntil: true });
  const providers = parseProviders(getFlagValue(args, '--providers'));
  const sampleLimit = Math.max(1, Math.min(1000, parsePositiveInt(getFlagValue(args, '--sample'), DEFAULT_SAMPLE)));
  const pretty = hasFlag(args, '--pretty');

  if (sinceFlagRaw && !sinceDate) {
    throw new Error('Invalid --since. Use YYYY-MM-DD or ISO datetime.');
  }
  if (untilFlagRaw && !untilDate) {
    throw new Error('Invalid --until. Use YYYY-MM-DD or ISO datetime.');
  }

  const now = new Date();
  const since = sinceDate ?? new Date(now.getTime() - (days * DAY_MS));
  const untilExclusive = untilDate ?? now;

  if (untilExclusive <= since) {
    throw new Error('--until must be greater than --since.');
  }

  const prisma = new PrismaClient();
  try {
    const paidOrdersRaw = await prisma.orders.findMany({
      where: {
        status: OrderStatus.PAID,
        is_plan: 1,
        OR: [{ is_canceled: null }, { is_canceled: 0 }],
        date_order: {
          gte: since,
          lt: untilExclusive,
        },
      },
      select: {
        id: true,
        user_id: true,
        payment_method: true,
        plan_id: true,
        date_order: true,
      },
      orderBy: { id: 'asc' },
    });

    const paidOrders: Array<PaidPlanOrder & { provider: AuditProvider }> = paidOrdersRaw
      .map((row) => {
        const provider = resolveProvider(row.payment_method);
        if (!provider) return null;
        return {
          id: row.id,
          userId: row.user_id,
          paymentMethod: row.payment_method,
          planId: row.plan_id ?? null,
          dateOrder: row.date_order,
          provider,
        };
      })
      .filter((row): row is PaidPlanOrder & { provider: AuditProvider } => Boolean(row))
      .filter((row) => providers.has(row.provider));

    const orderIds = paidOrders.map((row) => row.id);
    const userIds = Array.from(new Set(paidOrders.map((row) => row.userId)));
    const planIds = Array.from(
      new Set(
        paidOrders
          .map((row) => row.planId)
          .filter((value): value is number => Number.isFinite(value)),
      ),
    );

    const [planRows, linkedRowsRaw, userRowsRaw] = await Promise.all([
      planIds.length
        ? prisma.plans.findMany({
            where: { id: { in: planIds } },
            select: { id: true, duration: true },
          })
        : Promise.resolve([]),
      orderIds.length
        ? prisma.descargasUser.findMany({
            where: { order_id: { in: orderIds } },
            select: {
              order_id: true,
              user_id: true,
              date_end: true,
            },
          })
        : Promise.resolve([]),
      userIds.length
        ? prisma.descargasUser.findMany({
            where: { user_id: { in: userIds } },
            select: {
              order_id: true,
              user_id: true,
              date_end: true,
            },
          })
        : Promise.resolve([]),
    ]);

    const planDurationById = new Map<number, number>();
    for (const row of planRows) {
      planDurationById.set(row.id, toDurationDays(row.duration));
    }

    const linkedByOrder = new Map<number, DescargasRow[]>();
    for (const row of linkedRowsRaw) {
      const orderId = row.order_id ?? null;
      if (!orderId) continue;
      const current = linkedByOrder.get(orderId) ?? [];
      current.push({
        orderId,
        userId: row.user_id,
        dateEnd: row.date_end,
      });
      linkedByOrder.set(orderId, current);
    }

    const byUser = new Map<number, DescargasRow[]>();
    for (const row of userRowsRaw) {
      const current = byUser.get(row.user_id) ?? [];
      current.push({
        orderId: row.order_id ?? null,
        userId: row.user_id,
        dateEnd: row.date_end,
      });
      byUser.set(row.user_id, current);
    }

    const providerSummaries: Record<AuditProvider, ProviderSummary> = {
      stripe: emptySummary(),
      stripe_oxxo: emptySummary(),
      paypal: emptySummary(),
      conekta: emptySummary(),
      admin: emptySummary(),
    };

    const missingOrderIdsByProvider: Record<AuditProvider, number[]> = {
      stripe: [],
      stripe_oxxo: [],
      paypal: [],
      conekta: [],
      admin: [],
    };

    for (const order of paidOrders) {
      const summary = providerSummaries[order.provider];
      summary.paidOrders += 1;

      const linkedRows = linkedByOrder.get(order.id) ?? [];
      if (linkedRows.length > 1) {
        summary.duplicateLinkedRows += linkedRows.length - 1;
      }

      const durationDays = order.planId
        ? planDurationById.get(order.planId) ?? 30
        : 30;
      const activationClass = classifyActivation(order, {
        linkedRowsCount: linkedRows.length,
        userRows: byUser.get(order.userId) ?? [],
        durationDays,
      });

      switch (activationClass) {
        case 'linked':
          summary.linkedActivation += 1;
          break;
        case 'probable_unlinked':
          summary.probableUnlinkedActivation += 1;
          break;
        case 'weak_unlinked':
          summary.weakUnlinkedActivation += 1;
          break;
        case 'missing':
          summary.missingActivation += 1;
          if (missingOrderIdsByProvider[order.provider].length < sampleLimit) {
            missingOrderIdsByProvider[order.provider].push(order.id);
          }
          break;
        default:
          break;
      }
    }

    for (const provider of ALL_PROVIDERS) {
      const summary = providerSummaries[provider];
      summary.linkedCoveragePct = calcPct(summary.linkedActivation, summary.paidOrders);
      summary.coverageIncludingProbablePct = calcPct(
        summary.linkedActivation + summary.probableUnlinkedActivation,
        summary.paidOrders,
      );
    }

    const totals = emptySummary();
    for (const provider of ALL_PROVIDERS) {
      const summary = providerSummaries[provider];
      totals.paidOrders += summary.paidOrders;
      totals.linkedActivation += summary.linkedActivation;
      totals.probableUnlinkedActivation += summary.probableUnlinkedActivation;
      totals.weakUnlinkedActivation += summary.weakUnlinkedActivation;
      totals.missingActivation += summary.missingActivation;
      totals.duplicateLinkedRows += summary.duplicateLinkedRows;
    }
    totals.linkedCoveragePct = calcPct(totals.linkedActivation, totals.paidOrders);
    totals.coverageIncludingProbablePct = calcPct(
      totals.linkedActivation + totals.probableUnlinkedActivation,
      totals.paidOrders,
    );

    const report: AuditReport = {
      generatedAt: new Date().toISOString(),
      range: {
        since: since.toISOString(),
        untilExclusive: untilExclusive.toISOString(),
        untilHuman: new Date(untilExclusive.getTime() - 1).toISOString(),
        timezone: 'UTC',
      },
      providers: providerSummaries,
      totals,
      samples: {
        maxPerProvider: sampleLimit,
        missingOrderIdsByProvider,
      },
    };

    // Intentionally avoids printing PII or provider payment identifiers.
    const output = pretty
      ? JSON.stringify(report, null, 2)
      : JSON.stringify(report);

    // eslint-disable-next-line no-console
    console.log(output);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  log.error('[PAYMENTS_ACTIVATION_AUDIT] Script failed.', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
