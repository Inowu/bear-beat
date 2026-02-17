import { Prisma, PrismaClient } from '@prisma/client';
import { ingestAnalyticsEvents } from './index';

type AnalyticsAttribution = {
  source?: string | null;
  medium?: string | null;
  campaign?: string | null;
  term?: string | null;
  content?: string | null;
  fbclid?: string | null;
  gclid?: string | null;
};

interface PaymentAttributionContextRow {
  sessionId: string | null;
  visitorId: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
  fbclid: string | null;
  gclid: string | null;
  eventName: string;
  eventTs: Date;
}

interface PaymentAttributionContext {
  sessionId: string | null;
  visitorId: string | null;
  attribution: AnalyticsAttribution | null;
  sourceEventName: string;
  sourceEventTs: Date;
}

interface IngestPaymentSuccessEventInput {
  prisma: PrismaClient;
  provider: string;
  providerEventId?: string | null;
  userId: number;
  orderId?: number | null;
  planId?: number | null;
  amount?: number | null;
  currency?: string | null;
  isRenewal?: boolean;
  eventTs?: Date;
  sessionId?: string | null;
  visitorId?: string | null;
  attribution?: AnalyticsAttribution | null;
  metadata?: Record<string, unknown>;
}

const CHECKOUT_CONTEXT_LOOKBACK_DAYS = 45;
const PAYMENT_CONTEXT_LOOKBACK_DAYS = 365;

const toNullableTrimmedString = (
  value: unknown,
  maxLen: number,
): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
};

const toNullablePositiveInt = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return null;
  const intVal = Math.trunc(parsed);
  return intVal > 0 ? intVal : null;
};

const toNullableFiniteAmount = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
};

const normalizeAttribution = (
  value: AnalyticsAttribution | null | undefined,
): AnalyticsAttribution | null => {
  if (!value) return null;
  const normalized: AnalyticsAttribution = {
    source: toNullableTrimmedString(value.source, 120),
    medium: toNullableTrimmedString(value.medium, 120),
    campaign: toNullableTrimmedString(value.campaign, 180),
    term: toNullableTrimmedString(value.term, 180),
    content: toNullableTrimmedString(value.content, 180),
    fbclid: toNullableTrimmedString(value.fbclid, 255),
    gclid: toNullableTrimmedString(value.gclid, 255),
  };
  return normalized.source
    || normalized.medium
    || normalized.campaign
    || normalized.term
    || normalized.content
    || normalized.fbclid
    || normalized.gclid
    ? normalized
    : null;
};

const mergeAttribution = (
  overrideAttribution: AnalyticsAttribution | null | undefined,
  fallbackAttribution: AnalyticsAttribution | null | undefined,
): AnalyticsAttribution | null => {
  const override = normalizeAttribution(overrideAttribution);
  const fallback = normalizeAttribution(fallbackAttribution);
  if (!override && !fallback) return null;
  return {
    source: override?.source ?? fallback?.source ?? null,
    medium: override?.medium ?? fallback?.medium ?? null,
    campaign: override?.campaign ?? fallback?.campaign ?? null,
    term: override?.term ?? fallback?.term ?? null,
    content: override?.content ?? fallback?.content ?? null,
    fbclid: override?.fbclid ?? fallback?.fbclid ?? null,
    gclid: override?.gclid ?? fallback?.gclid ?? null,
  };
};

const normalizeProvider = (provider: string): string => {
  const normalized = provider.trim().toLowerCase().replace(/[^a-z0-9_-]+/g, '_');
  return normalized || 'unknown';
};

const buildPaymentSuccessEventId = (params: {
  provider: string;
  orderId: number | null;
  providerEventId: string | null;
  userId: number;
}): string => {
  const provider = normalizeProvider(params.provider);
  if (params.orderId) {
    return `${provider}:order:${params.orderId}:payment_success`.slice(0, 80);
  }

  const providerEventId = toNullableTrimmedString(params.providerEventId, 40);
  if (providerEventId) {
    return `${provider}:event:${providerEventId}:payment_success`.slice(0, 80);
  }

  return `${provider}:user:${params.userId}:${Date.now()}:payment_success`.slice(0, 80);
};

const mapContextRow = (
  row: PaymentAttributionContextRow,
): PaymentAttributionContext => ({
  sessionId: toNullableTrimmedString(row.sessionId, 80),
  visitorId: toNullableTrimmedString(row.visitorId, 80),
  attribution: normalizeAttribution({
    source: row.source,
    medium: row.medium,
    campaign: row.campaign,
    term: row.term,
    content: row.content,
    fbclid: row.fbclid,
    gclid: row.gclid,
  }),
  sourceEventName: row.eventName,
  sourceEventTs: row.eventTs,
});

const resolvePlanFilterSql = (planId: number | null): Prisma.Sql => {
  if (!planId) return Prisma.empty;
  return Prisma.sql`
    AND NULLIF(
      CAST(JSON_UNQUOTE(JSON_EXTRACT(ae.metadata_json, '$.planId')) AS UNSIGNED),
      0
    ) = ${planId}
  `;
};

const resolvePaymentAttributionContext = async (params: {
  prisma: PrismaClient;
  userId: number;
  planId: number | null;
  eventTs: Date;
}): Promise<PaymentAttributionContext | null> => {
  const checkoutLookback = new Date(
    params.eventTs.getTime() - CHECKOUT_CONTEXT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  );
  const paymentLookback = new Date(
    params.eventTs.getTime() - PAYMENT_CONTEXT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  );
  const planFilterSql = resolvePlanFilterSql(params.planId);

  const checkoutRows = await params.prisma.$queryRaw<PaymentAttributionContextRow[]>(
    Prisma.sql`
      SELECT
        ae.session_id AS sessionId,
        ae.visitor_id AS visitorId,
        ae.utm_source AS source,
        ae.utm_medium AS medium,
        ae.utm_campaign AS campaign,
        ae.utm_term AS term,
        ae.utm_content AS content,
        ae.fbclid AS fbclid,
        ae.gclid AS gclid,
        ae.event_name AS eventName,
        ae.event_ts AS eventTs
      FROM analytics_events ae
      WHERE ae.user_id = ${params.userId}
        AND ae.event_ts <= ${params.eventTs}
        AND ae.event_ts >= ${checkoutLookback}
        AND ae.event_name IN ('checkout_started', 'checkout_start', 'checkout_method_selected')
        ${planFilterSql}
      ORDER BY ae.event_ts DESC
      LIMIT 1
    `,
  );

  const checkoutContext = checkoutRows[0];
  if (checkoutContext) {
    return mapContextRow(checkoutContext);
  }

  const paymentRows = await params.prisma.$queryRaw<PaymentAttributionContextRow[]>(
    Prisma.sql`
      SELECT
        ae.session_id AS sessionId,
        ae.visitor_id AS visitorId,
        ae.utm_source AS source,
        ae.utm_medium AS medium,
        ae.utm_campaign AS campaign,
        ae.utm_term AS term,
        ae.utm_content AS content,
        ae.fbclid AS fbclid,
        ae.gclid AS gclid,
        ae.event_name AS eventName,
        ae.event_ts AS eventTs
      FROM analytics_events ae
      WHERE ae.user_id = ${params.userId}
        AND ae.event_ts < ${params.eventTs}
        AND ae.event_ts >= ${paymentLookback}
        AND ae.event_name = 'payment_success'
        ${planFilterSql}
      ORDER BY ae.event_ts DESC
      LIMIT 1
    `,
  );

  const paymentContext = paymentRows[0];
  return paymentContext ? mapContextRow(paymentContext) : null;
};

export const ingestPaymentSuccessEvent = async ({
  prisma,
  provider,
  providerEventId = null,
  userId,
  orderId = null,
  planId = null,
  amount = null,
  currency = null,
  isRenewal = false,
  eventTs = new Date(),
  sessionId = null,
  visitorId = null,
  attribution = null,
  metadata = {},
}: IngestPaymentSuccessEventInput): Promise<void> => {
  if (!process.env.DATABASE_URL) return;

  const normalizedUserId = toNullablePositiveInt(userId);
  if (!normalizedUserId) return;

  const normalizedOrderId = toNullablePositiveInt(orderId);
  const normalizedPlanId = toNullablePositiveInt(planId);
  const context = await resolvePaymentAttributionContext({
    prisma,
    userId: normalizedUserId,
    planId: normalizedPlanId,
    eventTs,
  });

  const mergedAttribution = mergeAttribution(attribution, context?.attribution ?? null);
  const resolvedSessionId = toNullableTrimmedString(sessionId, 80)
    ?? context?.sessionId
    ?? null;
  const resolvedVisitorId = toNullableTrimmedString(visitorId, 80)
    ?? context?.visitorId
    ?? null;

  await ingestAnalyticsEvents({
    prisma,
    events: [
      {
        eventId: buildPaymentSuccessEventId({
          provider,
          orderId: normalizedOrderId,
          providerEventId,
          userId: normalizedUserId,
        }),
        eventName: 'payment_success',
        eventCategory: 'purchase',
        eventTs: eventTs.toISOString(),
        userId: normalizedUserId,
        sessionId: resolvedSessionId,
        visitorId: resolvedVisitorId,
        attribution: mergedAttribution,
        currency: toNullableTrimmedString(currency, 8),
        amount: toNullableFiniteAmount(amount),
        metadata: {
          orderId: normalizedOrderId,
          order_id: normalizedOrderId,
          planId: normalizedPlanId,
          plan_id: normalizedPlanId,
          paymentProvider: normalizeProvider(provider),
          payment_provider: normalizeProvider(provider),
          isRenewal: Boolean(isRenewal),
          is_renewal: Boolean(isRenewal),
          providerEventId: toNullableTrimmedString(providerEventId, 120),
          provider_event_id: toNullableTrimmedString(providerEventId, 120),
          contextSourceEvent: context?.sourceEventName ?? null,
          context_source_event: context?.sourceEventName ?? null,
          contextSourceTs: context?.sourceEventTs?.toISOString?.() ?? null,
          context_source_ts: context?.sourceEventTs?.toISOString?.() ?? null,
          ...metadata,
        },
      },
    ],
    sessionUserId: normalizedUserId,
  });
};
