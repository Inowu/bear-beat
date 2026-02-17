import './_loadEnv';

import { Prisma, PrismaClient } from '@prisma/client';
import { ensureAnalyticsEventsTableExists } from '../src/analytics';
import { ingestPaymentSuccessEvent } from '../src/analytics/paymentSuccess';
import { OrderStatus } from '../src/routers/subscriptions/interfaces/order-status.interface';
import { log } from '../src/server';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOOKBACK_DAYS = 3650;
const DEFAULT_BATCH_SIZE = 250;

type StripeOrderRow = {
  id: number;
  userId: number;
  planId: number | null;
  totalPrice: number;
  dateOrder: Date;
  paymentMethod: string | null;
  txnId: string | null;
  isPlan: number;
  currency: string | null;
};

type ExistingPaymentEventRow = {
  orderId: number | null;
  stripeSubscriptionId: string | null;
  stripePaymentIntentId: string | null;
};

type RenewalRow = {
  orderId: number;
  isRenewal: number;
};

const hasFlag = (args: string[], flag: string): boolean => args.includes(flag);

const getFlagValue = (args: string[], flag: string): string | null => {
  const index = args.indexOf(flag);
  if (index < 0 || index + 1 >= args.length) return null;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) return null;
  return value.trim();
};

const parsePositiveInt = (raw: string | null, fallback: number): number => {
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  const asInt = Math.floor(parsed);
  return asInt > 0 ? asInt : fallback;
};

const parseDateOption = (raw: string | null): Date | null => {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
    ? `${trimmed}T00:00:00.000Z`
    : trimmed;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const toNullableTrimmedString = (
  value: unknown,
  maxLen: number,
): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
};

const toNullableTxId = (value: unknown): string | null =>
  toNullableTrimmedString(value, 120);

const resolveStripeProvider = (paymentMethod: string | null): string => {
  const normalized = String(paymentMethod || '').toLowerCase();
  return normalized.includes('oxxo') ? 'stripe_oxxo' : 'stripe';
};

const toCurrency = (value: unknown): string | null => {
  const normalized = toNullableTrimmedString(value, 8);
  return normalized ? normalized.toUpperCase() : null;
};

const toAmount = (value: unknown): number => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
};

const fetchStripePaidOrdersBatch = async ({
  prisma,
  afterId,
  since,
  until,
  batchSize,
}: {
  prisma: PrismaClient;
  afterId: number;
  since: Date;
  until: Date;
  batchSize: number;
}): Promise<StripeOrderRow[]> =>
  prisma.$queryRaw<StripeOrderRow[]>(Prisma.sql`
    SELECT
      o.id AS id,
      o.user_id AS userId,
      o.plan_id AS planId,
      o.total_price AS totalPrice,
      o.date_order AS dateOrder,
      o.payment_method AS paymentMethod,
      o.txn_id AS txnId,
      o.is_plan AS isPlan,
      p.moneda AS currency
    FROM orders o
    LEFT JOIN plans p ON p.id = o.plan_id
    WHERE o.id > ${afterId}
      AND o.status = ${OrderStatus.PAID}
      AND (o.is_canceled IS NULL OR o.is_canceled = 0)
      AND o.date_order >= ${since}
      AND o.date_order < ${until}
      AND LOWER(COALESCE(o.payment_method, '')) LIKE ${'%stripe%'}
    ORDER BY o.id ASC
    LIMIT ${batchSize}
  `);

const fetchExistingPaymentEvents = async ({
  prisma,
  orderIds,
  txnIds,
}: {
  prisma: PrismaClient;
  orderIds: number[];
  txnIds: string[];
}): Promise<ExistingPaymentEventRow[]> => {
  if (!orderIds.length) return [];

  const txnCondition = txnIds.length
    ? Prisma.sql`
      OR NULLIF(JSON_UNQUOTE(JSON_EXTRACT(ae.metadata_json, '$.stripeSubscriptionId')), '')
        IN (${Prisma.join(txnIds)})
      OR NULLIF(JSON_UNQUOTE(JSON_EXTRACT(ae.metadata_json, '$.stripePaymentIntentId')), '')
        IN (${Prisma.join(txnIds)})
    `
    : Prisma.empty;

  return prisma.$queryRaw<ExistingPaymentEventRow[]>(Prisma.sql`
    SELECT
      COALESCE(
        NULLIF(
          CAST(JSON_UNQUOTE(JSON_EXTRACT(ae.metadata_json, '$.order_id')) AS UNSIGNED),
          0
        ),
        NULLIF(
          CAST(JSON_UNQUOTE(JSON_EXTRACT(ae.metadata_json, '$.orderId')) AS UNSIGNED),
          0
        )
      ) AS orderId,
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(ae.metadata_json, '$.stripeSubscriptionId')), '')
        AS stripeSubscriptionId,
      NULLIF(JSON_UNQUOTE(JSON_EXTRACT(ae.metadata_json, '$.stripePaymentIntentId')), '')
        AS stripePaymentIntentId
    FROM analytics_events ae
    WHERE ae.event_name = 'payment_success'
      AND (
        COALESCE(
          NULLIF(
            CAST(JSON_UNQUOTE(JSON_EXTRACT(ae.metadata_json, '$.order_id')) AS UNSIGNED),
            0
          ),
          NULLIF(
            CAST(JSON_UNQUOTE(JSON_EXTRACT(ae.metadata_json, '$.orderId')) AS UNSIGNED),
            0
          )
        ) IN (${Prisma.join(orderIds)})
        ${txnCondition}
      )
  `);
};

const fetchRenewalMap = async ({
  prisma,
  orderIds,
}: {
  prisma: PrismaClient;
  orderIds: number[];
}): Promise<Map<number, boolean>> => {
  if (!orderIds.length) return new Map();

  const rows = await prisma.$queryRaw<RenewalRow[]>(Prisma.sql`
    SELECT
      o.id AS orderId,
      CASE
        WHEN o.is_plan = 1
          AND EXISTS (
            SELECT 1
            FROM orders prev
            WHERE prev.user_id = o.user_id
              AND prev.status = ${OrderStatus.PAID}
              AND (prev.is_canceled IS NULL OR prev.is_canceled = 0)
              AND prev.is_plan = 1
              AND (
                (prev.plan_id IS NULL AND o.plan_id IS NULL)
                OR prev.plan_id = o.plan_id
              )
              AND (
                prev.date_order < o.date_order
                OR (prev.date_order = o.date_order AND prev.id < o.id)
              )
          )
          THEN 1
        ELSE 0
      END AS isRenewal
    FROM orders o
    WHERE o.id IN (${Prisma.join(orderIds)})
  `);

  return new Map(
    rows.map((row) => [
      row.orderId,
      Number(row.isRenewal) === 1,
    ]),
  );
};

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    log.warn('[PAYMENT_SUCCESS_BACKFILL] DATABASE_URL not configured. Skipping.');
    return;
  }

  const args = process.argv.slice(2);
  const apply = hasFlag(args, '--apply');
  const days = Math.max(
    1,
    Math.min(36500, parsePositiveInt(getFlagValue(args, '--days'), DEFAULT_LOOKBACK_DAYS)),
  );
  const batchSize = Math.max(
    1,
    Math.min(1000, parsePositiveInt(getFlagValue(args, '--batch-size'), DEFAULT_BATCH_SIZE)),
  );
  const limitRaw = getFlagValue(args, '--limit');
  const limit = limitRaw ? Math.max(1, parsePositiveInt(limitRaw, 0)) : null;
  const sinceArg = parseDateOption(getFlagValue(args, '--since'));
  const untilArg = parseDateOption(getFlagValue(args, '--until'));

  if ((getFlagValue(args, '--since') && !sinceArg) || (getFlagValue(args, '--until') && !untilArg)) {
    throw new Error(
      'Invalid date option. Use ISO date (`YYYY-MM-DD`) or ISO datetime for --since/--until.',
    );
  }

  const now = new Date();
  const since = sinceArg ?? new Date(now.getTime() - days * DAY_MS);
  const until = untilArg ?? now;
  if (until <= since) {
    throw new Error('--until must be greater than --since.');
  }

  if (!apply) {
    log.info(
      '[PAYMENT_SUCCESS_BACKFILL] Dry-run mode. Pass --apply to insert missing events.',
      {
        since: since.toISOString(),
        until: until.toISOString(),
        batchSize,
        limit,
      },
    );
  }

  const prisma = new PrismaClient();
  let scannedOrders = 0;
  let missingOrders = 0;
  let insertedEvents = 0;
  let failedEvents = 0;
  let lastSeenOrderId = 0;
  let stopEarly = false;

  try {
    await ensureAnalyticsEventsTableExists(prisma);

    while (!stopEarly) {
      const batch = await fetchStripePaidOrdersBatch({
        prisma,
        afterId: lastSeenOrderId,
        since,
        until,
        batchSize,
      });

      if (!batch.length) break;
      scannedOrders += batch.length;
      lastSeenOrderId = batch[batch.length - 1].id;

      const orderIds = batch.map((row) => row.id);
      const txnIds = Array.from(
        new Set(
          batch
            .map((row) => toNullableTxId(row.txnId))
            .filter((value): value is string => Boolean(value)),
        ),
      );

      const existingRows = await fetchExistingPaymentEvents({
        prisma,
        orderIds,
        txnIds,
      });

      const existingOrderIds = new Set<number>();
      const existingTxnIds = new Set<string>();
      for (const row of existingRows) {
        if (Number.isFinite(Number(row.orderId)) && Number(row.orderId) > 0) {
          existingOrderIds.add(Number(row.orderId));
        }

        const subscriptionId = toNullableTxId(row.stripeSubscriptionId);
        if (subscriptionId) existingTxnIds.add(subscriptionId);
        const paymentIntentId = toNullableTxId(row.stripePaymentIntentId);
        if (paymentIntentId) existingTxnIds.add(paymentIntentId);
      }

      const missingBatch = batch.filter((row) => {
        if (existingOrderIds.has(row.id)) return false;
        const txnId = toNullableTxId(row.txnId);
        if (txnId && existingTxnIds.has(txnId)) return false;
        return true;
      });

      if (!missingBatch.length) {
        log.info('[PAYMENT_SUCCESS_BACKFILL] Batch processed.', {
          scannedOrders,
          missingOrders,
          insertedEvents,
          failedEvents,
        });
        continue;
      }

      let pendingBatch = missingBatch;
      if (limit != null) {
        const remaining = limit - (apply ? insertedEvents + failedEvents : missingOrders);
        if (remaining <= 0) {
          stopEarly = true;
          break;
        }
        pendingBatch = missingBatch.slice(0, remaining);
        if (pendingBatch.length < missingBatch.length) {
          stopEarly = true;
        }
      }

      missingOrders += pendingBatch.length;

      if (apply) {
        const renewalMap = await fetchRenewalMap({
          prisma,
          orderIds: pendingBatch.map((row) => row.id),
        });

        for (const order of pendingBatch) {
          try {
            await ingestPaymentSuccessEvent({
              prisma,
              provider: resolveStripeProvider(order.paymentMethod),
              providerEventId: `backfill_order_${order.id}`,
              userId: order.userId,
              orderId: order.id,
              planId: order.planId ?? null,
              amount: toAmount(order.totalPrice),
              currency: toCurrency(order.currency),
              isRenewal: renewalMap.get(order.id) ?? false,
              eventTs: new Date(order.dateOrder),
              metadata: {
                backfillSource: 'stripe_paid_order_without_payment_success',
                paymentMethod: toNullableTrimmedString(order.paymentMethod, 80),
              },
            });
            insertedEvents += 1;
          } catch (error) {
            failedEvents += 1;
            log.warn('[PAYMENT_SUCCESS_BACKFILL] Failed to ingest one event (continuing).', {
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      }

      log.info('[PAYMENT_SUCCESS_BACKFILL] Batch processed.', {
        scannedOrders,
        missingOrders,
        insertedEvents,
        failedEvents,
      });
    }

    log.info('[PAYMENT_SUCCESS_BACKFILL] Completed.', {
      mode: apply ? 'apply' : 'dry-run',
      since: since.toISOString(),
      until: until.toISOString(),
      scannedOrders,
      missingOrders,
      insertedEvents,
      failedEvents,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  log.error('[PAYMENT_SUCCESS_BACKFILL] Script failed.', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
