import './_loadEnv';

import { Prisma, PrismaClient } from '@prisma/client';
import { ensureAnalyticsEventsTableExists, ingestAnalyticsEvents } from '../src/analytics';
import { PaymentService } from '../src/routers/subscriptions/services/types';
import { getPlanKey } from '../src/utils/getPlanKey';
import { log } from '../src/server';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_LOOKBACK_DAYS = 90;
const DEFAULT_BATCH_SIZE = 200;

type TrialEventKind = 'trial_started' | 'trial_converted';

type WebhookInboxRow = {
  id: number;
  provider: string;
  event_id: string;
  event_type: string;
  payload_raw: string;
  received_at: Date;
  status: string;
};

type TrialCandidate = {
  kind: TrialEventKind;
  eventId: string;
  userId: number;
  eventTs: Date;
  planId: number | null;
  stripeSubscriptionId: string | null;
  webhookEventType: string;
  inboxProvider: string;
  inboxId: number;
};

type SubscriptionPayload = {
  id?: string;
  customer?: string | { id?: string };
  status?: string;
  created?: number;
  current_period_start?: number;
  trial_end?: number | null;
  start_date?: number;
  metadata?: Record<string, unknown>;
  items?: {
    data?: Array<{
      price?: { id?: string } | string;
    }>;
  };
  plan?: {
    id?: string;
  };
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

const toPositiveInt = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  const intVal = Math.trunc(parsed);
  return intVal > 0 ? intVal : null;
};

const toNullableString = (value: unknown, maxLen = 120): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
};

const toDateFromUnixSeconds = (value: unknown): Date | null => {
  const unix = toPositiveInt(value);
  if (!unix) return null;
  const parsed = new Date(unix * 1000);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const parseWebhookPayload = (raw: string): Record<string, any> | null => {
  try {
    return JSON.parse(raw) as Record<string, any>;
  } catch {
    return null;
  }
};

const buildEventId = (stripeEventId: string | null, suffix: TrialEventKind, inboxId: number): string => {
  const base = toNullableString(stripeEventId, 60);
  if (base) return `stripe:${base}:${suffix}`.slice(0, 80);
  return `stripe:inbox:${inboxId}:${suffix}`.slice(0, 80);
};

const extractPriceCandidates = (subscription: SubscriptionPayload): string[] => {
  const candidateA =
    typeof subscription.items?.data?.[0]?.price === 'string'
      ? subscription.items?.data?.[0]?.price
      : subscription.items?.data?.[0]?.price?.id;
  const candidateB = subscription.plan?.id;
  return [candidateA, candidateB]
    .map((entry) => toNullableString(entry, 120))
    .filter((entry): entry is string => Boolean(entry));
};

const findUserIdForSubscription = async (params: {
  prisma: PrismaClient;
  subscription: SubscriptionPayload;
  userByCustomerId: Map<string, number | null>;
}): Promise<number | null> => {
  const metadataUserId = toPositiveInt(subscription?.metadata?.userId);
  if (metadataUserId) return metadataUserId;

  const customerId =
    typeof subscription?.customer === 'string'
      ? toNullableString(subscription.customer, 120)
      : toNullableString(subscription?.customer?.id, 120);
  if (!customerId) return null;

  if (!params.userByCustomerId.has(customerId)) {
    const user = await params.prisma.users.findFirst({
      where: { stripe_cusid: customerId },
      select: { id: true },
    });
    params.userByCustomerId.set(customerId, user?.id ?? null);
  }

  return params.userByCustomerId.get(customerId) ?? null;
};

const resolvePlanIdForSubscription = async (params: {
  prisma: PrismaClient;
  subscription: SubscriptionPayload;
  orderPlanByOrderId: Map<number, number | null>;
  planByPriceId: Map<string, number | null>;
}): Promise<number | null> => {
  const metadataOrderId = toPositiveInt(params.subscription?.metadata?.orderId);
  if (metadataOrderId) {
    if (!params.orderPlanByOrderId.has(metadataOrderId)) {
      const order = await params.prisma.orders.findFirst({
        where: { id: metadataOrderId },
        select: { plan_id: true },
      });
      params.orderPlanByOrderId.set(metadataOrderId, order?.plan_id ?? null);
    }
    return params.orderPlanByOrderId.get(metadataOrderId) ?? null;
  }

  const stripePlanKey = getPlanKey(PaymentService.STRIPE);
  const priceCandidates = extractPriceCandidates(params.subscription);
  for (const candidate of priceCandidates) {
    if (!params.planByPriceId.has(candidate)) {
      const plan = await params.prisma.plans.findFirst({
        where: {
          [stripePlanKey]: candidate,
        } as any,
        select: { id: true },
      });
      params.planByPriceId.set(candidate, plan?.id ?? null);
    }

    const planId = params.planByPriceId.get(candidate) ?? null;
    if (planId) return planId;
  }

  return null;
};

const fetchExistingEventIds = async (
  prisma: PrismaClient,
  eventIds: string[],
): Promise<Set<string>> => {
  if (!eventIds.length) return new Set();
  const rows = await prisma.$queryRaw<Array<{ eventId: string }>>(Prisma.sql`
    SELECT event_id AS eventId
    FROM analytics_events
    WHERE event_id IN (${Prisma.join(eventIds)})
  `);
  return new Set(rows.map((row) => row.eventId));
};

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    log.warn('[TRIAL_EVENTS_BACKFILL] DATABASE_URL not configured. Skipping.');
    return;
  }

  const args = process.argv.slice(2);
  const apply = hasFlag(args, '--apply');
  const days = Math.max(
    1,
    Math.min(3650, parsePositiveInt(getFlagValue(args, '--days'), DEFAULT_LOOKBACK_DAYS)),
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
    log.info('[TRIAL_EVENTS_BACKFILL] Dry-run mode. Pass --apply to insert missing events.', {
      since: since.toISOString(),
      until: until.toISOString(),
      batchSize,
      limit,
    });
  }

  const prisma = new PrismaClient();
  const userByCustomerId = new Map<string, number | null>();
  const orderPlanByOrderId = new Map<number, number | null>();
  const planByPriceId = new Map<string, number | null>();

  let scannedWebhooks = 0;
  let parsedCandidates = 0;
  let skippedInvalidPayload = 0;
  let skippedNoUser = 0;
  let skippedNoTransition = 0;
  let missingEvents = 0;
  let insertedEvents = 0;
  let failedEvents = 0;
  let lastSeenId = 0;
  let stopEarly = false;

  try {
    await ensureAnalyticsEventsTableExists(prisma);

    while (!stopEarly) {
      const rows = await prisma.webhookInboxEvent.findMany({
        where: {
          id: { gt: lastSeenId },
          provider: { in: ['stripe', 'stripe_pi'] },
          event_type: {
            in: [
              'customer.subscription.created',
              'customer.subscription.updated',
            ],
          },
          received_at: { gte: since, lt: until },
        },
        orderBy: { id: 'asc' },
        take: batchSize,
        select: {
          id: true,
          provider: true,
          event_id: true,
          event_type: true,
          payload_raw: true,
          received_at: true,
          status: true,
        },
      }) as WebhookInboxRow[];

      if (!rows.length) break;
      scannedWebhooks += rows.length;
      lastSeenId = rows[rows.length - 1].id;

      const candidates: TrialCandidate[] = [];

      for (const row of rows) {
        const payload = parseWebhookPayload(row.payload_raw);
        if (!payload) {
          skippedInvalidPayload += 1;
          continue;
        }

        const subscription = (payload?.data?.object ?? null) as SubscriptionPayload | null;
        if (!subscription || typeof subscription !== 'object') {
          skippedInvalidPayload += 1;
          continue;
        }

        const currentStatus = toNullableString(subscription.status, 40)?.toLowerCase();
        const previousStatus = toNullableString(
          payload?.data?.previous_attributes?.status,
          40,
        )?.toLowerCase();

        let eventKind: TrialEventKind | null = null;
        if (row.event_type === 'customer.subscription.created' && currentStatus === 'trialing') {
          eventKind = 'trial_started';
        }
        if (
          row.event_type === 'customer.subscription.updated'
          && currentStatus === 'active'
          && previousStatus === 'trialing'
        ) {
          eventKind = 'trial_converted';
        }

        if (!eventKind) {
          skippedNoTransition += 1;
          continue;
        }

        const userId = await findUserIdForSubscription({
          prisma,
          subscription,
          userByCustomerId,
        });
        if (!userId) {
          skippedNoUser += 1;
          continue;
        }

        const planId = await resolvePlanIdForSubscription({
          prisma,
          subscription,
          orderPlanByOrderId,
          planByPriceId,
        });

        const eventTs =
          toDateFromUnixSeconds(
            eventKind === 'trial_started'
              ? subscription.start_date ?? subscription.created ?? subscription.current_period_start
              : subscription.current_period_start ?? subscription.created,
          )
          ?? row.received_at;

        parsedCandidates += 1;
        candidates.push({
          kind: eventKind,
          eventId: buildEventId(row.event_id, eventKind, row.id),
          userId,
          eventTs,
          planId,
          stripeSubscriptionId: toNullableString(subscription.id, 120),
          webhookEventType: row.event_type,
          inboxProvider: row.provider,
          inboxId: row.id,
        });
      }

      if (!candidates.length) {
        log.info('[TRIAL_EVENTS_BACKFILL] Batch processed.', {
          scannedWebhooks,
          parsedCandidates,
          skippedInvalidPayload,
          skippedNoUser,
          skippedNoTransition,
          missingEvents,
          insertedEvents,
          failedEvents,
        });
        continue;
      }

      const uniqueEventIds = Array.from(new Set(candidates.map((candidate) => candidate.eventId)));
      const existingEventIds = await fetchExistingEventIds(prisma, uniqueEventIds);

      let pending = candidates.filter((candidate) => !existingEventIds.has(candidate.eventId));
      if (limit != null) {
        const remaining = limit - (apply ? insertedEvents + failedEvents : missingEvents);
        if (remaining <= 0) {
          stopEarly = true;
          break;
        }
        pending = pending.slice(0, remaining);
        if (pending.length < candidates.length) stopEarly = true;
      }

      if (!pending.length) {
        log.info('[TRIAL_EVENTS_BACKFILL] Batch processed.', {
          scannedWebhooks,
          parsedCandidates,
          skippedInvalidPayload,
          skippedNoUser,
          skippedNoTransition,
          missingEvents,
          insertedEvents,
          failedEvents,
        });
        continue;
      }

      missingEvents += pending.length;

      if (apply) {
        const events = pending.map((candidate) => ({
          eventId: candidate.eventId,
          eventName: candidate.kind,
          eventCategory: 'purchase' as const,
          eventTs: candidate.eventTs.toISOString(),
          userId: candidate.userId,
          amount: candidate.kind === 'trial_started' ? 0 : null,
          metadata: {
            planId: candidate.planId,
            stripeSubscriptionId: candidate.stripeSubscriptionId,
            webhookEventType: candidate.webhookEventType,
            webhookProvider: candidate.inboxProvider,
            webhookInboxId: candidate.inboxId,
            backfillSource: 'webhook_inbox_trial_events',
          },
        }));

        try {
          await ingestAnalyticsEvents({
            prisma,
            events,
          });
          insertedEvents += events.length;
        } catch (error) {
          failedEvents += events.length;
          log.warn('[TRIAL_EVENTS_BACKFILL] Failed to ingest one batch (continuing).', {
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      log.info('[TRIAL_EVENTS_BACKFILL] Batch processed.', {
        scannedWebhooks,
        parsedCandidates,
        skippedInvalidPayload,
        skippedNoUser,
        skippedNoTransition,
        missingEvents,
        insertedEvents,
        failedEvents,
      });
    }

    log.info('[TRIAL_EVENTS_BACKFILL] Completed.', {
      mode: apply ? 'apply' : 'dry-run',
      since: since.toISOString(),
      until: until.toISOString(),
      scannedWebhooks,
      parsedCandidates,
      skippedInvalidPayload,
      skippedNoUser,
      skippedNoTransition,
      missingEvents,
      insertedEvents,
      failedEvents,
    });
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  log.error('[TRIAL_EVENTS_BACKFILL] Script failed.', {
    error: error instanceof Error ? error.message : String(error),
  });
  process.exitCode = 1;
});
