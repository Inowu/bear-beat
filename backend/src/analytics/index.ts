import { createHash } from 'crypto';
import { Prisma, PrismaClient } from '@prisma/client';
import { z } from 'zod';

const MAX_BATCH_SIZE = 40;
const DEFAULT_RANGE_DAYS = 30;
const DEFAULT_ATTRIBUTION_LIMIT = 12;
const MAX_ATTRIBUTION_LIMIT = 40;
const SESSION_INACTIVITY_MINUTES = 30;

const analyticsEventCategorySchema = z.enum([
  'navigation',
  'acquisition',
  'engagement',
  'registration',
  'checkout',
  'purchase',
  'support',
  'activation',
  'retention',
  'system',
]);

const analyticsAttributionSchema = z
  .object({
    source: z.string().max(120).optional().nullable(),
    medium: z.string().max(120).optional().nullable(),
    campaign: z.string().max(180).optional().nullable(),
    term: z.string().max(180).optional().nullable(),
    content: z.string().max(180).optional().nullable(),
    fbclid: z.string().max(255).optional().nullable(),
    gclid: z.string().max(255).optional().nullable(),
  })
  .nullable()
  .optional();

export const analyticsEventInputSchema = z.object({
  eventId: z.string().min(8).max(80),
  eventName: z
    .string()
    .min(2)
    .max(80)
    .regex(/^[a-zA-Z0-9_.:-]+$/),
  eventCategory: analyticsEventCategorySchema.optional(),
  eventTs: z.string().datetime().optional(),
  sessionId: z.string().max(80).optional().nullable(),
  visitorId: z.string().max(80).optional().nullable(),
  userId: z.number().int().positive().optional().nullable(),
  pagePath: z.string().max(255).optional().nullable(),
  pageUrl: z.string().max(1000).optional().nullable(),
  referrer: z.string().max(1000).optional().nullable(),
  attribution: analyticsAttributionSchema,
  countryCode: z.string().max(8).optional().nullable(),
  currency: z.string().max(8).optional().nullable(),
  amount: z.number().finite().min(0).max(999999999).optional().nullable(),
  metadata: z.record(z.any()).optional(),
});

export const analyticsEventBatchSchema = z.object({
  events: z.array(analyticsEventInputSchema).min(1).max(MAX_BATCH_SIZE),
});

export type AnalyticsEventInput = z.infer<typeof analyticsEventInputSchema>;

type AnalyticsEventCategory = z.infer<typeof analyticsEventCategorySchema>;

interface IngestAnalyticsEventsInput {
  prisma: PrismaClient;
  events: AnalyticsEventInput[];
  sessionUserId?: number | null;
  clientIp?: string | null;
  userAgent?: string | null;
}

interface RequestLike {
  headers?: Record<string, string | string[] | undefined>;
  ip?: string | null;
  socket?: {
    remoteAddress?: string | null;
  };
}

interface AnalyticsFunnelOverview {
  range: {
    days: number;
    start: string;
    end: string;
    sessionInactivityMinutes: number;
  };
  volume: {
    visitors: number;
    lpToRegister: number;
    registrations: number;
    checkoutStarted: number;
    eventPayments: number;
    paidOrders: number;
    paidUsers: number;
    grossRevenue: number;
    activationD1Users: number;
    registrationCohort: number;
    retainedD30Users: number;
    retentionD30Base: number;
    chatOpened: number;
  };
  conversion: {
    visitorToRegisterPct: number;
    registerToCheckoutPct: number;
    checkoutToPaidPct: number;
    visitorToPaidPct: number;
    activationD1Pct: number;
    retentionD30Pct: number;
  };
}

interface AnalyticsDailyPoint {
  day: string;
  visitors: number;
  registrations: number;
  checkoutStarted: number;
  purchases: number;
}

interface AnalyticsAttributionPoint {
  source: string;
  medium: string;
  campaign: string;
  visitors: number;
  registrations: number;
  checkouts: number;
  purchases: number;
  revenue: number;
  aov: number;
}

interface AnalyticsBusinessMetrics {
  range: {
    days: number;
    start: string;
    end: string;
    churnWindowDays: number;
  };
  kpis: {
    paidOrders: number;
    paidUsers: number;
    grossRevenue: number;
    avgOrderValue: number;
    arpu: number;
    monthlyRecurringRevenueEstimate: number;
    monthlyArpuEstimate: number;
    repeatPurchaseRatePct: number;
    refundRatePct: number;
    churnMonthlyPct: number;
    ltvEstimate: number | null;
    cacEstimate: number | null;
    paybackMonthsEstimate: number | null;
  };
  cohorts: {
    previousActiveUsers: number;
    currentActiveUsers: number;
    lostUsers: number;
    newUsers: number;
  };
  assumptions: {
    cacSource: 'manual-input' | 'env-default' | 'not-available';
    adSpendUsed: number | null;
  };
}

interface AnalyticsUxRoutePoint {
  pagePath: string;
  samples: number;
  poorCount: number;
  poorRatePct: number;
  lcpAvg: number | null;
  clsAvg: number | null;
  inpAvg: number | null;
}

interface AnalyticsUxDevicePoint {
  deviceCategory: string;
  samples: number;
  poorCount: number;
  poorRatePct: number;
  lcpAvg: number | null;
  clsAvg: number | null;
  inpAvg: number | null;
}

interface AnalyticsUxSummary {
  range: {
    days: number;
    start: string;
    end: string;
  };
  totals: {
    samples: number;
    poorCount: number;
    poorRatePct: number;
    lcpAvg: number | null;
    clsAvg: number | null;
    inpAvg: number | null;
  };
  routes: AnalyticsUxRoutePoint[];
  devices: AnalyticsUxDevicePoint[];
}

interface AnalyticsTopEventPoint {
  eventName: string;
  eventCategory: string;
  totalEvents: number;
  uniqueVisitors: number;
  uniqueSessions: number;
}

interface AnalyticsCrmDailyRegistrationPoint {
  day: string;
  registrations: number;
  cumulative: number;
}

interface AnalyticsCrmDailyTrialPoint {
  day: string;
  trialStarts: number;
  trialConversions: number;
}

interface AnalyticsCrmCancellationReasonPoint {
  reasonCode: string;
  cancellations: number;
}

interface AnalyticsCrmTrialNoDownloadPoint {
  userId: number;
  username: string;
  email: string;
  phone: string | null;
  trialStartedAt: string;
  planId: number | null;
}

interface AnalyticsCrmPaidNoDownloadPoint {
  userId: number;
  username: string;
  email: string;
  phone: string | null;
  paidAt: string;
  planId: number | null;
  paymentMethod: string | null;
}

interface AnalyticsCrmRecentCancellationPoint {
  id: number;
  userId: number;
  username: string;
  email: string;
  phone: string | null;
  paymentMethod: string | null;
  createdAt: string;
  reasonCode: string;
  reasonText: string | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
}

interface AnalyticsCrmDashboardSnapshot {
  range: {
    days: number;
    start: string;
    end: string;
  };
  kpis: {
    totalUsers: number;
    registrations: number;
    paidOrders: number;
    newPaidUsers: number;
    renewalOrders: number;
    grossRevenue: number;
    avgOrderValue: number;
    trialStarts: number;
    trialConversions: number;
    trialConversionRatePct: number;
    cancellations: number;
    involuntaryCancellations: number;
    avgHoursPaidToFirstDownload: number | null;
    avgHoursRegisterToFirstPaid: number | null;
  };
  registrationsDaily: AnalyticsCrmDailyRegistrationPoint[];
  trialsDaily: AnalyticsCrmDailyTrialPoint[];
  cancellationTopReasons: AnalyticsCrmCancellationReasonPoint[];
  recentCancellations: AnalyticsCrmRecentCancellationPoint[];
  trialNoDownload24h: AnalyticsCrmTrialNoDownloadPoint[];
  paidNoDownload24h: AnalyticsCrmPaidNoDownloadPoint[];
}

type AnalyticsAlertSeverity = 'critical' | 'warning' | 'info';

interface AnalyticsHealthAlert {
  id: string;
  severity: AnalyticsAlertSeverity;
  title: string;
  message: string;
  metric: string;
  value: number;
  threshold: number;
  recommendation: string;
}

interface AnalyticsHealthAlertsSnapshot {
  generatedAt: string;
  alerts: AnalyticsHealthAlert[];
}

interface AnalyticsEventDbRow {
  eventId: string;
  eventName: string;
  eventCategory: AnalyticsEventCategory;
  eventTs: Date;
  sessionId: string | null;
  visitorId: string | null;
  userId: number | null;
  pagePath: string | null;
  pageUrl: string | null;
  referrer: string | null;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  utmTerm: string | null;
  utmContent: string | null;
  fbclid: string | null;
  gclid: string | null;
  countryCode: string | null;
  currency: string | null;
  amount: number | null;
  metadataJson: string | null;
  ipHash: string | null;
  userAgent: string | null;
}

const EVENT_CATEGORY_HINTS: Array<{ hint: string; category: AnalyticsEventCategory }> = [
  { hint: 'page_', category: 'navigation' },
  { hint: 'lp_', category: 'acquisition' },
  { hint: 'lead_', category: 'acquisition' },
  { hint: 'registration_', category: 'registration' },
  { hint: 'checkout_', category: 'checkout' },
  { hint: 'payment_', category: 'purchase' },
  { hint: 'purchase_', category: 'purchase' },
  { hint: 'support_', category: 'support' },
  { hint: 'download_', category: 'activation' },
  { hint: 'retention_', category: 'retention' },
];

const toNullableTrimmedString = (
  value: unknown,
  maxLength = 1000,
): string | null => {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  if (!normalized.length) return null;
  return normalized.slice(0, maxLength);
};

const toNullableNumber = (value: unknown): number | null => {
  if (typeof value !== 'number') return null;
  if (!Number.isFinite(value)) return null;
  if (value < 0) return null;
  return value;
};

const parseEventDate = (value?: string): Date => {
  if (!value) return new Date();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date();
  return parsed;
};

const getReferrerHost = (referrer: string | null): string | null => {
  if (!referrer) return null;
  try {
    return new URL(referrer).hostname.slice(0, 255);
  } catch {
    return null;
  }
};

const resolveEventCategory = (
  eventName: string,
  explicitCategory?: AnalyticsEventCategory,
): AnalyticsEventCategory => {
  if (explicitCategory) return explicitCategory;
  const lowerEventName = eventName.toLowerCase();
  const foundHint = EVENT_CATEGORY_HINTS.find(({ hint }) =>
    lowerEventName.startsWith(hint),
  );
  return foundHint?.category ?? 'system';
};

const safeJsonStringify = (value: unknown): string | null => {
  if (!value || typeof value !== 'object') return null;
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
};

const numberFromUnknown = (value: unknown): number => {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const nullableNumberFromUnknown = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

const roundNumber = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

const calculateRate = (numerator: number, denominator: number): number => {
  if (!denominator || denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 10000) / 100;
};

const normalizeDateOutput = (value: Date): string =>
  value.toISOString().slice(0, 19) + 'Z';

const ipHashSalt = process.env.ANALYTICS_IP_SALT || process.env.JWT_SECRET || '';

const hashIpAddress = (ipAddress: string | null): string | null => {
  if (!ipAddress) return null;
  if (!ipHashSalt) return null;
  return createHash('sha256')
    .update(`${ipHashSalt}:${ipAddress}`)
    .digest('hex');
};

export const getClientIpFromRequest = (req: RequestLike): string | null => {
  const forwarded = req.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    const forwardedIp = forwarded.split(',')[0]?.trim();
    if (forwardedIp) return forwardedIp.slice(0, 120);
  }
  if (Array.isArray(forwarded) && forwarded.length > 0) {
    const firstForwarded = forwarded[0]?.split(',')[0]?.trim();
    if (firstForwarded) return firstForwarded.slice(0, 120);
  }
  if (req.ip) return req.ip.slice(0, 120);
  if (req.socket?.remoteAddress) return req.socket.remoteAddress.slice(0, 120);
  return null;
};

const normalizeAnalyticsEvent = (
  event: AnalyticsEventInput,
  sessionUserId: number | null,
  ipHash: string | null,
  userAgent: string | null,
): AnalyticsEventDbRow => {
  const attribution = event.attribution ?? {};
  const referrer = toNullableTrimmedString(event.referrer, 1000);
  return {
    eventId: event.eventId,
    eventName: event.eventName.toLowerCase(),
    eventCategory: resolveEventCategory(event.eventName, event.eventCategory),
    eventTs: parseEventDate(event.eventTs),
    sessionId: toNullableTrimmedString(event.sessionId, 80),
    visitorId: toNullableTrimmedString(event.visitorId, 80),
    userId: event.userId ?? sessionUserId ?? null,
    pagePath: toNullableTrimmedString(event.pagePath, 255),
    pageUrl: toNullableTrimmedString(event.pageUrl, 1000),
    referrer,
    referrerHost: getReferrerHost(referrer),
    utmSource: toNullableTrimmedString(attribution.source, 120),
    utmMedium: toNullableTrimmedString(attribution.medium, 120),
    utmCampaign: toNullableTrimmedString(attribution.campaign, 180),
    utmTerm: toNullableTrimmedString(attribution.term, 180),
    utmContent: toNullableTrimmedString(attribution.content, 180),
    fbclid: toNullableTrimmedString(attribution.fbclid, 255),
    gclid: toNullableTrimmedString(attribution.gclid, 255),
    countryCode: toNullableTrimmedString(event.countryCode, 8),
    currency: toNullableTrimmedString(event.currency, 8),
    amount: toNullableNumber(event.amount),
    metadataJson: safeJsonStringify(event.metadata),
    ipHash,
    userAgent: toNullableTrimmedString(userAgent, 500),
  };
};

let analyticsTableReadyPromise: Promise<void> | null = null;

const ensureAnalyticsEventsTable = async (
  prisma: PrismaClient,
): Promise<void> => {
  if (analyticsTableReadyPromise) {
    await analyticsTableReadyPromise;
    return;
  }

  analyticsTableReadyPromise = (async () => {
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS analytics_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        event_id VARCHAR(80) NOT NULL,
        event_name VARCHAR(80) NOT NULL,
        event_category VARCHAR(40) NOT NULL,
        event_ts DATETIME(3) NOT NULL,
        received_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        session_id VARCHAR(80) NULL,
        visitor_id VARCHAR(80) NULL,
        user_id INT NULL,
        page_path VARCHAR(255) NULL,
        page_url VARCHAR(1000) NULL,
        referrer VARCHAR(1000) NULL,
        referrer_host VARCHAR(255) NULL,
        utm_source VARCHAR(120) NULL,
        utm_medium VARCHAR(120) NULL,
        utm_campaign VARCHAR(180) NULL,
        utm_term VARCHAR(180) NULL,
        utm_content VARCHAR(180) NULL,
        fbclid VARCHAR(255) NULL,
        gclid VARCHAR(255) NULL,
        country_code VARCHAR(8) NULL,
        currency VARCHAR(8) NULL,
        amount DECIMAL(12,2) NULL,
        metadata_json JSON NULL,
        ip_hash CHAR(64) NULL,
        user_agent VARCHAR(500) NULL,
        created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
        PRIMARY KEY (id),
        UNIQUE KEY uniq_analytics_event_id (event_id),
        KEY idx_analytics_event_ts (event_ts),
        KEY idx_analytics_event_name_ts (event_name, event_ts),
        KEY idx_analytics_user_ts (user_id, event_ts),
        KEY idx_analytics_source_campaign (utm_source, utm_campaign, event_ts),
        KEY idx_analytics_session_ts (session_id, event_ts),
        KEY idx_analytics_visitor_ts (visitor_id, event_ts)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  })().catch((error) => {
    analyticsTableReadyPromise = null;
    throw error;
  });

  await analyticsTableReadyPromise;
};

// Used by other modules (automation runner, webhooks) that need to query analytics_events safely.
export const ensureAnalyticsEventsTableExists = async (
  prisma: PrismaClient,
): Promise<void> => ensureAnalyticsEventsTable(prisma);

export const ingestAnalyticsEvents = async ({
  prisma,
  events,
  sessionUserId = null,
  clientIp = null,
  userAgent = null,
}: IngestAnalyticsEventsInput): Promise<{ accepted: number }> => {
  await ensureAnalyticsEventsTable(prisma);

  const ipHash = hashIpAddress(clientIp);
  const normalizedEvents = events.map((event) =>
    normalizeAnalyticsEvent(event, sessionUserId, ipHash, userAgent),
  );

  if (!normalizedEvents.length) {
    return { accepted: 0 };
  }

  const insertRows = normalizedEvents.map((event) => Prisma.sql`
    (
      ${event.eventId},
      ${event.eventName},
      ${event.eventCategory},
      ${event.eventTs},
      ${event.sessionId},
      ${event.visitorId},
      ${event.userId},
      ${event.pagePath},
      ${event.pageUrl},
      ${event.referrer},
      ${event.referrerHost},
      ${event.utmSource},
      ${event.utmMedium},
      ${event.utmCampaign},
      ${event.utmTerm},
      ${event.utmContent},
      ${event.fbclid},
      ${event.gclid},
      ${event.countryCode},
      ${event.currency},
      ${event.amount},
      ${event.metadataJson},
      ${event.ipHash},
      ${event.userAgent}
    )
  `);

  await prisma.$executeRaw(Prisma.sql`
    INSERT IGNORE INTO analytics_events (
      event_id,
      event_name,
      event_category,
      event_ts,
      session_id,
      visitor_id,
      user_id,
      page_path,
      page_url,
      referrer,
      referrer_host,
      utm_source,
      utm_medium,
      utm_campaign,
      utm_term,
      utm_content,
      fbclid,
      gclid,
      country_code,
      currency,
      amount,
      metadata_json,
      ip_hash,
      user_agent
    ) VALUES ${Prisma.join(insertRows)}
  `);

  return { accepted: normalizedEvents.length };
};

const normalizeDaysInput = (days?: number): number => {
  if (!days || !Number.isFinite(days)) return DEFAULT_RANGE_DAYS;
  return Math.max(7, Math.min(365, Math.floor(days)));
};

const resolveRange = (daysInput?: number): { days: number; startDate: Date } => {
  const days = normalizeDaysInput(daysInput);
  const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return { days, startDate };
};

export const getAnalyticsFunnelOverview = async (
  prisma: PrismaClient,
  daysInput?: number,
): Promise<AnalyticsFunnelOverview> => {
  if (!process.env.DATABASE_URL) {
    const { days, startDate } = resolveRange(daysInput);
    return {
      range: {
        days,
        start: normalizeDateOutput(startDate),
        end: normalizeDateOutput(new Date()),
        sessionInactivityMinutes: SESSION_INACTIVITY_MINUTES,
      },
      volume: {
        visitors: 0,
        lpToRegister: 0,
        registrations: 0,
        checkoutStarted: 0,
        eventPayments: 0,
        paidOrders: 0,
        paidUsers: 0,
        grossRevenue: 0,
        activationD1Users: 0,
        registrationCohort: 0,
        retainedD30Users: 0,
        retentionD30Base: 0,
        chatOpened: 0,
      },
      conversion: {
        visitorToRegisterPct: 0,
        registerToCheckoutPct: 0,
        checkoutToPaidPct: 0,
        visitorToPaidPct: 0,
        activationD1Pct: 0,
        retentionD30Pct: 0,
      },
    };
  }

  await ensureAnalyticsEventsTable(prisma);
  const { days, startDate } = resolveRange(daysInput);

  const [eventRows, orderRows, activationRows, registrationRows, retentionBaseRows, retentionRows] =
    await Promise.all([
      prisma.$queryRaw<
        Array<{
          visitors: bigint | number;
          lpToRegister: bigint | number;
          registrations: bigint | number;
          checkoutStarted: bigint | number;
          eventPayments: bigint | number;
          chatOpened: bigint | number;
        }>
      >(Prisma.sql`
        SELECT
          COUNT(DISTINCT CASE
            WHEN event_name = 'page_view'
              THEN COALESCE(visitor_id, session_id, CONCAT('anon:', event_id))
          END) AS visitors,
          COUNT(DISTINCT CASE
            WHEN event_name = 'lp_to_register'
              THEN COALESCE(visitor_id, session_id, CONCAT('anon:', event_id))
          END) AS lpToRegister,
          COUNT(DISTINCT CASE
            WHEN event_name = 'registration_completed'
              THEN COALESCE(CAST(user_id AS CHAR), visitor_id, session_id, event_id)
          END) AS registrations,
          COUNT(DISTINCT CASE
            WHEN event_name = 'checkout_started'
              THEN COALESCE(session_id, visitor_id, CONCAT('anon:', event_id))
          END) AS checkoutStarted,
          COUNT(DISTINCT CASE
            WHEN event_name = 'payment_success'
              THEN COALESCE(CAST(user_id AS CHAR), session_id, visitor_id, event_id)
          END) AS eventPayments,
          COUNT(DISTINCT CASE
            WHEN event_name = 'support_chat_opened'
              THEN COALESCE(session_id, visitor_id, event_id)
          END) AS chatOpened
        FROM analytics_events
        WHERE event_ts >= ${startDate}
      `),
      prisma.$queryRaw<
        Array<{
          paidOrders: bigint | number;
          paidUsers: bigint | number;
          grossRevenue: bigint | number;
        }>
      >(Prisma.sql`
        SELECT
          COUNT(*) AS paidOrders,
          COUNT(DISTINCT user_id) AS paidUsers,
          COALESCE(SUM(total_price), 0) AS grossRevenue
        FROM orders
        WHERE status = 1
          AND date_order >= ${startDate}
          AND (is_canceled IS NULL OR is_canceled = 0)
      `),
      prisma.$queryRaw<Array<{ activationD1Users: bigint | number }>>(Prisma.sql`
        SELECT
          COUNT(DISTINCT u.id) AS activationD1Users
        FROM users u
        INNER JOIN download_history dh
          ON dh.userId = u.id
        WHERE u.registered_on >= DATE(${startDate})
          AND dh.date >= u.registered_on
          AND dh.date < DATE_ADD(u.registered_on, INTERVAL 1 DAY)
      `),
      prisma.$queryRaw<Array<{ registrationCohort: bigint | number }>>(Prisma.sql`
        SELECT
          COUNT(*) AS registrationCohort
        FROM users
        WHERE registered_on >= DATE(${startDate})
      `),
      prisma.$queryRaw<Array<{ retentionD30Base: bigint | number }>>(Prisma.sql`
        SELECT
          COUNT(DISTINCT o.user_id) AS retentionD30Base
        FROM orders o
        WHERE o.status = 1
          AND (o.is_canceled IS NULL OR o.is_canceled = 0)
          AND o.date_order < DATE_SUB(NOW(), INTERVAL 30 DAY)
      `),
      prisma.$queryRaw<Array<{ retainedD30Users: bigint | number }>>(Prisma.sql`
        SELECT
          COUNT(DISTINCT o.user_id) AS retainedD30Users
        FROM orders o
        INNER JOIN download_history dh
          ON dh.userId = o.user_id
        WHERE o.status = 1
          AND (o.is_canceled IS NULL OR o.is_canceled = 0)
          AND o.date_order < DATE_SUB(NOW(), INTERVAL 30 DAY)
          AND dh.date >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      `),
    ]);

  const eventVolume = eventRows[0] ?? {
    visitors: 0,
    lpToRegister: 0,
    registrations: 0,
    checkoutStarted: 0,
    eventPayments: 0,
    chatOpened: 0,
  };
  const orderVolume = orderRows[0] ?? {
    paidOrders: 0,
    paidUsers: 0,
    grossRevenue: 0,
  };
  const activationVolume = activationRows[0] ?? { activationD1Users: 0 };
  const registrationVolume = registrationRows[0] ?? { registrationCohort: 0 };
  const retentionBaseVolume = retentionBaseRows[0] ?? { retentionD30Base: 0 };
  const retentionVolume = retentionRows[0] ?? { retainedD30Users: 0 };

  const visitors = numberFromUnknown(eventVolume.visitors);
  const lpToRegister = numberFromUnknown(eventVolume.lpToRegister);
  const registrations = numberFromUnknown(eventVolume.registrations);
  const checkoutStarted = numberFromUnknown(eventVolume.checkoutStarted);
  const eventPayments = numberFromUnknown(eventVolume.eventPayments);
  const paidOrders = numberFromUnknown(orderVolume.paidOrders);
  const paidUsers = numberFromUnknown(orderVolume.paidUsers);
  const grossRevenue = numberFromUnknown(orderVolume.grossRevenue);
  const activationD1Users = numberFromUnknown(activationVolume.activationD1Users);
  const registrationCohort = numberFromUnknown(registrationVolume.registrationCohort);
  const retentionD30Base = numberFromUnknown(retentionBaseVolume.retentionD30Base);
  const retainedD30Users = numberFromUnknown(retentionVolume.retainedD30Users);
  const chatOpened = numberFromUnknown(eventVolume.chatOpened);

  const paidSignal = eventPayments > 0 ? eventPayments : paidOrders;

  return {
    range: {
      days,
      start: normalizeDateOutput(startDate),
      end: normalizeDateOutput(new Date()),
      sessionInactivityMinutes: SESSION_INACTIVITY_MINUTES,
    },
    volume: {
      visitors,
      lpToRegister,
      registrations,
      checkoutStarted,
      eventPayments,
      paidOrders,
      paidUsers,
      grossRevenue: Math.round(grossRevenue * 100) / 100,
      activationD1Users,
      registrationCohort,
      retainedD30Users,
      retentionD30Base,
      chatOpened,
    },
    conversion: {
      visitorToRegisterPct: calculateRate(registrations, visitors),
      registerToCheckoutPct: calculateRate(checkoutStarted, registrations),
      checkoutToPaidPct: calculateRate(paidSignal, checkoutStarted),
      visitorToPaidPct: calculateRate(paidSignal, visitors),
      activationD1Pct: calculateRate(activationD1Users, registrationCohort),
      retentionD30Pct: calculateRate(retainedD30Users, retentionD30Base),
    },
  };
};

export const getAnalyticsDailySeries = async (
  prisma: PrismaClient,
  daysInput?: number,
): Promise<AnalyticsDailyPoint[]> => {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  await ensureAnalyticsEventsTable(prisma);
  const { startDate } = resolveRange(daysInput);

  const rows = await prisma.$queryRaw<
    Array<{
      day: string;
      visitors: bigint | number;
      registrations: bigint | number;
      checkoutStarted: bigint | number;
      purchases: bigint | number;
    }>
  >(Prisma.sql`
    SELECT
      DATE_FORMAT(event_ts, '%Y-%m-%d') AS day,
      COUNT(DISTINCT CASE
        WHEN event_name = 'page_view'
          THEN COALESCE(visitor_id, session_id, CONCAT('anon:', event_id))
      END) AS visitors,
      COUNT(CASE WHEN event_name = 'registration_completed' THEN 1 END) AS registrations,
      COUNT(CASE WHEN event_name = 'checkout_started' THEN 1 END) AS checkoutStarted,
      COUNT(CASE WHEN event_name = 'payment_success' THEN 1 END) AS purchases
    FROM analytics_events
    WHERE event_ts >= ${startDate}
    GROUP BY DATE_FORMAT(event_ts, '%Y-%m-%d')
    ORDER BY day ASC
  `);

  return rows.map((row) => ({
    day: row.day,
    visitors: numberFromUnknown(row.visitors),
    registrations: numberFromUnknown(row.registrations),
    checkoutStarted: numberFromUnknown(row.checkoutStarted),
    purchases: numberFromUnknown(row.purchases),
  }));
};

export const getAnalyticsAttributionBreakdown = async (
  prisma: PrismaClient,
  daysInput?: number,
  limitInput?: number,
): Promise<AnalyticsAttributionPoint[]> => {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  await ensureAnalyticsEventsTable(prisma);
  const { startDate } = resolveRange(daysInput);
  const limit = limitInput
    ? Math.max(1, Math.min(MAX_ATTRIBUTION_LIMIT, Math.floor(limitInput)))
    : DEFAULT_ATTRIBUTION_LIMIT;

  const rows = await prisma.$queryRaw<
    Array<{
      source: string | null;
      medium: string | null;
      campaign: string | null;
      visitors: bigint | number;
      registrations: bigint | number;
      checkouts: bigint | number;
      purchases: bigint | number;
      revenue: unknown;
    }>
  >(Prisma.sql`
    SELECT
      COALESCE(NULLIF(utm_source, ''), 'direct') AS source,
      COALESCE(NULLIF(utm_medium, ''), 'none') AS medium,
      COALESCE(NULLIF(utm_campaign, ''), '(none)') AS campaign,
      COUNT(DISTINCT CASE
        WHEN event_name = 'page_view'
          THEN COALESCE(visitor_id, session_id, CONCAT('anon:', event_id))
      END) AS visitors,
      COUNT(CASE WHEN event_name = 'registration_completed' THEN 1 END) AS registrations,
      COUNT(CASE WHEN event_name = 'checkout_started' THEN 1 END) AS checkouts,
      COUNT(CASE WHEN event_name = 'payment_success' THEN 1 END) AS purchases,
      COALESCE(SUM(CASE
        WHEN event_name = 'payment_success' THEN COALESCE(amount, 0)
        ELSE 0
      END), 0) AS revenue
    FROM analytics_events
    WHERE event_ts >= ${startDate}
    GROUP BY source, medium, campaign
    ORDER BY purchases DESC, registrations DESC, visitors DESC
    LIMIT ${limit}
  `);

  return rows.map((row) => {
    const purchases = numberFromUnknown(row.purchases);
    const revenue = roundNumber(numberFromUnknown(row.revenue), 2);
    return {
      source: row.source || 'direct',
      medium: row.medium || 'none',
      campaign: row.campaign || '(none)',
      visitors: numberFromUnknown(row.visitors),
      registrations: numberFromUnknown(row.registrations),
      checkouts: numberFromUnknown(row.checkouts),
      purchases,
      revenue,
      aov: purchases > 0 ? roundNumber(revenue / purchases, 2) : 0,
    };
  });
};

export const getAnalyticsBusinessMetrics = async (
  prisma: PrismaClient,
  daysInput?: number,
  adSpendInput?: number,
): Promise<AnalyticsBusinessMetrics> => {
  if (!process.env.DATABASE_URL) {
    const { days, startDate } = resolveRange(daysInput);
    return {
      range: {
        days,
        start: normalizeDateOutput(startDate),
        end: normalizeDateOutput(new Date()),
        churnWindowDays: 30,
      },
      kpis: {
        paidOrders: 0,
        paidUsers: 0,
        grossRevenue: 0,
        avgOrderValue: 0,
        arpu: 0,
        monthlyRecurringRevenueEstimate: 0,
        monthlyArpuEstimate: 0,
        repeatPurchaseRatePct: 0,
        refundRatePct: 0,
        churnMonthlyPct: 0,
        ltvEstimate: null,
        cacEstimate: null,
        paybackMonthsEstimate: null,
      },
      cohorts: {
        previousActiveUsers: 0,
        currentActiveUsers: 0,
        lostUsers: 0,
        newUsers: 0,
      },
      assumptions: {
        cacSource: 'not-available',
        adSpendUsed: null,
      },
    };
  }

  await ensureAnalyticsEventsTable(prisma);
  const { days, startDate } = resolveRange(daysInput);
  const now = new Date();
  const currentWindowStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const previousWindowStart = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [
    rangeOrdersRows,
    repeatBuyersRows,
    currentWindowRows,
    previousUsersRows,
    lostUsersRows,
    newUsersRows,
  ] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        paidOrders: bigint | number;
        paidUsers: bigint | number;
        grossRevenue: bigint | number;
        refundedOrders: bigint | number;
      }>
    >(Prisma.sql`
      SELECT
        COUNT(*) AS paidOrders,
        COUNT(DISTINCT user_id) AS paidUsers,
        COALESCE(SUM(total_price), 0) AS grossRevenue,
        COUNT(CASE WHEN is_canceled = 1 THEN 1 END) AS refundedOrders
      FROM orders
      WHERE status = 1
        AND date_order >= ${startDate}
    `),
    prisma.$queryRaw<Array<{ repeatBuyers: bigint | number }>>(Prisma.sql`
      SELECT
        COUNT(*) AS repeatBuyers
      FROM (
        SELECT user_id
        FROM orders
        WHERE status = 1
          AND (is_canceled IS NULL OR is_canceled = 0)
          AND date_order >= ${startDate}
        GROUP BY user_id
        HAVING COUNT(*) >= 2
      ) repeated
    `),
    prisma.$queryRaw<
      Array<{
        activeUsers: bigint | number;
        revenue: bigint | number;
      }>
    >(Prisma.sql`
      SELECT
        COUNT(DISTINCT user_id) AS activeUsers,
        COALESCE(SUM(total_price), 0) AS revenue
      FROM orders
      WHERE status = 1
        AND (is_canceled IS NULL OR is_canceled = 0)
        AND date_order >= ${currentWindowStart}
    `),
    prisma.$queryRaw<Array<{ previousUsers: bigint | number }>>(Prisma.sql`
      SELECT
        COUNT(DISTINCT user_id) AS previousUsers
      FROM orders
      WHERE status = 1
        AND (is_canceled IS NULL OR is_canceled = 0)
        AND date_order >= ${previousWindowStart}
        AND date_order < ${currentWindowStart}
    `),
    prisma.$queryRaw<Array<{ lostUsers: bigint | number }>>(Prisma.sql`
      SELECT
        COUNT(DISTINCT prev.user_id) AS lostUsers
      FROM (
        SELECT DISTINCT user_id
        FROM orders
        WHERE status = 1
          AND (is_canceled IS NULL OR is_canceled = 0)
          AND date_order >= ${previousWindowStart}
          AND date_order < ${currentWindowStart}
      ) prev
      LEFT JOIN (
        SELECT DISTINCT user_id
        FROM orders
        WHERE status = 1
          AND (is_canceled IS NULL OR is_canceled = 0)
          AND date_order >= ${currentWindowStart}
      ) curr
        ON curr.user_id = prev.user_id
      WHERE curr.user_id IS NULL
    `),
    prisma.$queryRaw<Array<{ newUsers: bigint | number }>>(Prisma.sql`
      SELECT
        COUNT(DISTINCT curr.user_id) AS newUsers
      FROM (
        SELECT DISTINCT user_id
        FROM orders
        WHERE status = 1
          AND (is_canceled IS NULL OR is_canceled = 0)
          AND date_order >= ${currentWindowStart}
      ) curr
      LEFT JOIN (
        SELECT DISTINCT user_id
        FROM orders
        WHERE status = 1
          AND (is_canceled IS NULL OR is_canceled = 0)
          AND date_order >= ${previousWindowStart}
          AND date_order < ${currentWindowStart}
      ) prev
        ON prev.user_id = curr.user_id
      WHERE prev.user_id IS NULL
    `),
  ]);

  const rangeOrders = rangeOrdersRows[0] ?? {
    paidOrders: 0,
    paidUsers: 0,
    grossRevenue: 0,
    refundedOrders: 0,
  };
  const repeatBuyers = repeatBuyersRows[0] ?? { repeatBuyers: 0 };
  const currentWindow = currentWindowRows[0] ?? { activeUsers: 0, revenue: 0 };
  const previousWindow = previousUsersRows[0] ?? { previousUsers: 0 };
  const lostWindow = lostUsersRows[0] ?? { lostUsers: 0 };
  const newWindow = newUsersRows[0] ?? { newUsers: 0 };

  const paidOrders = numberFromUnknown(rangeOrders.paidOrders);
  const paidUsers = numberFromUnknown(rangeOrders.paidUsers);
  const grossRevenue = numberFromUnknown(rangeOrders.grossRevenue);
  const refundedOrders = numberFromUnknown(rangeOrders.refundedOrders);
  const repeatBuyerCount = numberFromUnknown(repeatBuyers.repeatBuyers);
  const currentActiveUsers = numberFromUnknown(currentWindow.activeUsers);
  const currentRevenue = numberFromUnknown(currentWindow.revenue);
  const previousActiveUsers = numberFromUnknown(previousWindow.previousUsers);
  const lostUsers = numberFromUnknown(lostWindow.lostUsers);
  const newUsers = numberFromUnknown(newWindow.newUsers);

  const avgOrderValue = paidOrders > 0 ? grossRevenue / paidOrders : 0;
  const arpu = paidUsers > 0 ? grossRevenue / paidUsers : 0;
  const monthlyArpuEstimate = currentActiveUsers > 0 ? currentRevenue / currentActiveUsers : 0;
  const refundRatePct = calculateRate(refundedOrders, paidOrders);
  const churnMonthlyPct = calculateRate(lostUsers, previousActiveUsers);
  const repeatPurchaseRatePct = calculateRate(repeatBuyerCount, paidUsers);

  const churnFraction = churnMonthlyPct / 100;
  const ltvEstimate =
    churnFraction > 0 && Number.isFinite(monthlyArpuEstimate)
      ? roundNumber(monthlyArpuEstimate / churnFraction, 2)
      : null;

  const adSpendFromEnv = Number(process.env.ANALYTICS_MONTHLY_AD_SPEND);
  const hasAdSpendInput = Number.isFinite(adSpendInput ?? NaN);
  const hasEnvAdSpend = Number.isFinite(adSpendFromEnv);
  const adSpendUsed = hasAdSpendInput
    ? Number(adSpendInput)
    : hasEnvAdSpend
      ? adSpendFromEnv
      : null;
  const cacSource = hasAdSpendInput
    ? 'manual-input'
    : hasEnvAdSpend
      ? 'env-default'
      : 'not-available';
  const cacEstimate =
    adSpendUsed !== null && newUsers > 0
      ? roundNumber(adSpendUsed / newUsers, 2)
      : null;
  const paybackMonthsEstimate =
    cacEstimate !== null && monthlyArpuEstimate > 0
      ? roundNumber(cacEstimate / monthlyArpuEstimate, 2)
      : null;

  return {
    range: {
      days,
      start: normalizeDateOutput(startDate),
      end: normalizeDateOutput(now),
      churnWindowDays: 30,
    },
    kpis: {
      paidOrders,
      paidUsers,
      grossRevenue: roundNumber(grossRevenue, 2),
      avgOrderValue: roundNumber(avgOrderValue, 2),
      arpu: roundNumber(arpu, 2),
      monthlyRecurringRevenueEstimate: roundNumber(currentRevenue, 2),
      monthlyArpuEstimate: roundNumber(monthlyArpuEstimate, 2),
      repeatPurchaseRatePct: roundNumber(repeatPurchaseRatePct, 2),
      refundRatePct: roundNumber(refundRatePct, 2),
      churnMonthlyPct: roundNumber(churnMonthlyPct, 2),
      ltvEstimate,
      cacEstimate,
      paybackMonthsEstimate,
    },
    cohorts: {
      previousActiveUsers,
      currentActiveUsers,
      lostUsers,
      newUsers,
    },
    assumptions: {
      cacSource,
      adSpendUsed: adSpendUsed === null ? null : roundNumber(adSpendUsed, 2),
    },
  };
};

export const getAnalyticsUxQuality = async (
  prisma: PrismaClient,
  daysInput?: number,
  routesLimitInput?: number,
): Promise<AnalyticsUxSummary> => {
  if (!process.env.DATABASE_URL) {
    const { days, startDate } = resolveRange(daysInput);
    return {
      range: {
        days,
        start: normalizeDateOutput(startDate),
        end: normalizeDateOutput(new Date()),
      },
      totals: {
        samples: 0,
        poorCount: 0,
        poorRatePct: 0,
        lcpAvg: null,
        clsAvg: null,
        inpAvg: null,
      },
      routes: [],
      devices: [],
    };
  }

  await ensureAnalyticsEventsTable(prisma);
  const { days, startDate } = resolveRange(daysInput);
  const routesLimit = routesLimitInput
    ? Math.max(3, Math.min(50, Math.floor(routesLimitInput)))
    : 12;

  const [totalsRows, routeRows, deviceRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        samples: bigint | number;
        poorCount: bigint | number;
        lcpAvg: number | null;
        clsAvg: number | null;
        inpAvg: number | null;
      }>
    >(Prisma.sql`
      SELECT
        COUNT(*) AS samples,
        SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.rating')) = 'poor' THEN 1 ELSE 0 END) AS poorCount,
        AVG(CASE
          WHEN JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.metricName')) = 'LCP'
            THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.value')) AS DECIMAL(14,4))
        END) AS lcpAvg,
        AVG(CASE
          WHEN JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.metricName')) = 'CLS'
            THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.value')) AS DECIMAL(14,6))
        END) AS clsAvg,
        AVG(CASE
          WHEN JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.metricName')) IN ('INP', 'FID')
            THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.value')) AS DECIMAL(14,4))
        END) AS inpAvg
      FROM analytics_events
      WHERE event_name = 'web_vital_reported'
        AND event_ts >= ${startDate}
    `),
    prisma.$queryRaw<
      Array<{
        pagePath: string | null;
        samples: bigint | number;
        poorCount: bigint | number;
        lcpAvg: number | null;
        clsAvg: number | null;
        inpAvg: number | null;
      }>
    >(Prisma.sql`
      SELECT
        COALESCE(NULLIF(page_path, ''), '/unknown') AS pagePath,
        COUNT(*) AS samples,
        SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.rating')) = 'poor' THEN 1 ELSE 0 END) AS poorCount,
        AVG(CASE
          WHEN JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.metricName')) = 'LCP'
            THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.value')) AS DECIMAL(14,4))
        END) AS lcpAvg,
        AVG(CASE
          WHEN JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.metricName')) = 'CLS'
            THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.value')) AS DECIMAL(14,6))
        END) AS clsAvg,
        AVG(CASE
          WHEN JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.metricName')) IN ('INP', 'FID')
            THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.value')) AS DECIMAL(14,4))
        END) AS inpAvg
      FROM analytics_events
      WHERE event_name = 'web_vital_reported'
        AND event_ts >= ${startDate}
      GROUP BY pagePath
      ORDER BY poorCount DESC, samples DESC
      LIMIT ${routesLimit}
    `),
    prisma.$queryRaw<
      Array<{
        deviceCategory: string | null;
        samples: bigint | number;
        poorCount: bigint | number;
        lcpAvg: number | null;
        clsAvg: number | null;
        inpAvg: number | null;
      }>
    >(Prisma.sql`
      SELECT
        COALESCE(
          NULLIF(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.deviceCategory')), ''),
          'unknown'
        ) AS deviceCategory,
        COUNT(*) AS samples,
        SUM(CASE WHEN JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.rating')) = 'poor' THEN 1 ELSE 0 END) AS poorCount,
        AVG(CASE
          WHEN JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.metricName')) = 'LCP'
            THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.value')) AS DECIMAL(14,4))
        END) AS lcpAvg,
        AVG(CASE
          WHEN JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.metricName')) = 'CLS'
            THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.value')) AS DECIMAL(14,6))
        END) AS clsAvg,
        AVG(CASE
          WHEN JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.metricName')) IN ('INP', 'FID')
            THEN CAST(JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.value')) AS DECIMAL(14,4))
        END) AS inpAvg
      FROM analytics_events
      WHERE event_name = 'web_vital_reported'
        AND event_ts >= ${startDate}
      GROUP BY deviceCategory
      ORDER BY samples DESC
    `),
  ]);

  const totals = totalsRows[0] ?? {
    samples: 0,
    poorCount: 0,
    lcpAvg: null,
    clsAvg: null,
    inpAvg: null,
  };

  const normalizeUxPoint = (
    samplesRaw: unknown,
    poorRaw: unknown,
    lcpRaw: unknown,
    clsRaw: unknown,
    inpRaw: unknown,
  ) => {
    const samples = numberFromUnknown(samplesRaw);
    const poorCount = numberFromUnknown(poorRaw);
    return {
      samples,
      poorCount,
      poorRatePct: roundNumber(calculateRate(poorCount, samples), 2),
      lcpAvg: nullableNumberFromUnknown(lcpRaw),
      clsAvg: nullableNumberFromUnknown(clsRaw),
      inpAvg: nullableNumberFromUnknown(inpRaw),
    };
  };

  return {
    range: {
      days,
      start: normalizeDateOutput(startDate),
      end: normalizeDateOutput(new Date()),
    },
    totals: normalizeUxPoint(
      totals.samples,
      totals.poorCount,
      totals.lcpAvg,
      totals.clsAvg,
      totals.inpAvg,
    ),
    routes: routeRows.map((row) => ({
      pagePath: row.pagePath || '/unknown',
      ...normalizeUxPoint(
        row.samples,
        row.poorCount,
        row.lcpAvg,
        row.clsAvg,
        row.inpAvg,
      ),
    })),
    devices: deviceRows.map((row) => ({
      deviceCategory: row.deviceCategory || 'unknown',
      ...normalizeUxPoint(
        row.samples,
        row.poorCount,
        row.lcpAvg,
        row.clsAvg,
        row.inpAvg,
      ),
    })),
  };
};

export const getAnalyticsTopEvents = async (
  prisma: PrismaClient,
  daysInput?: number,
  limitInput?: number,
): Promise<AnalyticsTopEventPoint[]> => {
  if (!process.env.DATABASE_URL) {
    return [];
  }

  await ensureAnalyticsEventsTable(prisma);
  const { startDate } = resolveRange(daysInput);
  const limit = limitInput ? Math.max(5, Math.min(60, Math.floor(limitInput))) : 20;

  const rows = await prisma.$queryRaw<
    Array<{
      eventName: string;
      eventCategory: string;
      totalEvents: bigint | number;
      uniqueVisitors: bigint | number;
      uniqueSessions: bigint | number;
    }>
  >(Prisma.sql`
    SELECT
      event_name AS eventName,
      event_category AS eventCategory,
      COUNT(*) AS totalEvents,
      COUNT(DISTINCT visitor_id) AS uniqueVisitors,
      COUNT(DISTINCT session_id) AS uniqueSessions
    FROM analytics_events
    WHERE event_ts >= ${startDate}
    GROUP BY event_name, event_category
    ORDER BY totalEvents DESC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    eventName: row.eventName,
    eventCategory: row.eventCategory,
    totalEvents: numberFromUnknown(row.totalEvents),
    uniqueVisitors: numberFromUnknown(row.uniqueVisitors),
    uniqueSessions: numberFromUnknown(row.uniqueSessions),
  }));
};

export const getAnalyticsCrmDashboard = async (
  prisma: PrismaClient,
  daysInput?: number,
  limitInput?: number,
): Promise<AnalyticsCrmDashboardSnapshot> => {
  const { days, startDate } = resolveRange(daysInput);
  const limit =
    typeof limitInput === 'number' && Number.isFinite(limitInput)
      ? Math.max(10, Math.min(300, Math.floor(limitInput)))
      : 60;

  if (!process.env.DATABASE_URL) {
    return {
      range: {
        days,
        start: normalizeDateOutput(startDate),
        end: normalizeDateOutput(new Date()),
      },
      kpis: {
        totalUsers: 0,
        registrations: 0,
        paidOrders: 0,
        newPaidUsers: 0,
        renewalOrders: 0,
        grossRevenue: 0,
        avgOrderValue: 0,
        trialStarts: 0,
        trialConversions: 0,
        trialConversionRatePct: 0,
        cancellations: 0,
        involuntaryCancellations: 0,
        avgHoursPaidToFirstDownload: null,
        avgHoursRegisterToFirstPaid: null,
      },
      registrationsDaily: [],
      trialsDaily: [],
      cancellationTopReasons: [],
      recentCancellations: [],
      trialNoDownload24h: [],
      paidNoDownload24h: [],
    };
  }

  await ensureAnalyticsEventsTable(prisma);

  const startDateOnly = startDate; // already Date object

  const [
    totalUsersRows,
    registrationsBeforeRows,
    registrationsDailyRows,
    paidOrdersRows,
    newVsRenewalRows,
    trialRows,
    trialDailyRows,
    cancellationsTotalRows,
    cancellationRows,
    recentCancellationRows,
    involuntaryCancellationRows,
    activationAvgRows,
    registerToPaidAvgRows,
    trialNoDownloadRows,
    paidNoDownloadRows,
  ] = await Promise.all([
    prisma.$queryRaw<Array<{ totalUsers: bigint | number }>>(Prisma.sql`
      SELECT COUNT(*) AS totalUsers
      FROM users
    `),
    prisma.$queryRaw<Array<{ registrationsBefore: bigint | number }>>(Prisma.sql`
      SELECT COUNT(*) AS registrationsBefore
      FROM users
      WHERE registered_on < DATE(${startDateOnly})
    `),
    prisma.$queryRaw<
      Array<{ day: string; registrations: bigint | number }>
    >(Prisma.sql`
      SELECT
        DATE_FORMAT(registered_on, '%Y-%m-%d') AS day,
        COUNT(*) AS registrations
      FROM users
      WHERE registered_on >= DATE(${startDateOnly})
      GROUP BY DATE_FORMAT(registered_on, '%Y-%m-%d')
      ORDER BY day ASC
    `),
    prisma.$queryRaw<
      Array<{ paidOrders: bigint | number; grossRevenue: bigint | number }>
    >(Prisma.sql`
      SELECT
        COUNT(*) AS paidOrders,
        COALESCE(SUM(total_price), 0) AS grossRevenue
      FROM orders
      WHERE status = 1
        AND is_plan = 1
        AND date_order >= ${startDateOnly}
        AND (is_canceled IS NULL OR is_canceled = 0)
    `),
    prisma.$queryRaw<
      Array<{ newPaidUsers: bigint | number; renewalOrders: bigint | number }>
    >(Prisma.sql`
      SELECT
        COUNT(CASE WHEN first_paid_at >= ${startDateOnly} THEN 1 END) AS newPaidUsers,
        COALESCE(SUM(CASE
          WHEN o.date_order >= ${startDateOnly}
            AND o.status = 1
            AND o.is_plan = 1
            AND (o.is_canceled IS NULL OR o.is_canceled = 0)
            AND o.date_order > first_paid_at
          THEN 1
          ELSE 0
        END), 0) AS renewalOrders
      FROM (
        SELECT user_id, MIN(date_order) AS first_paid_at
        FROM orders
        WHERE status = 1
          AND is_plan = 1
          AND (is_canceled IS NULL OR is_canceled = 0)
        GROUP BY user_id
      ) fp
      LEFT JOIN orders o
        ON o.user_id = fp.user_id
    `),
    prisma.$queryRaw<
      Array<{ trialStarts: bigint | number; trialConversions: bigint | number }>
    >(Prisma.sql`
      SELECT
        COALESCE(SUM(CASE WHEN event_name = 'trial_started' THEN 1 ELSE 0 END), 0) AS trialStarts,
        COALESCE(SUM(CASE WHEN event_name = 'trial_converted' THEN 1 ELSE 0 END), 0) AS trialConversions
      FROM analytics_events
      WHERE event_ts >= ${startDateOnly}
        AND event_name IN ('trial_started', 'trial_converted')
    `),
    prisma.$queryRaw<
      Array<{ day: string; trialStarts: bigint | number; trialConversions: bigint | number }>
    >(Prisma.sql`
      SELECT
        DATE_FORMAT(event_ts, '%Y-%m-%d') AS day,
        COUNT(CASE WHEN event_name = 'trial_started' THEN 1 END) AS trialStarts,
        COUNT(CASE WHEN event_name = 'trial_converted' THEN 1 END) AS trialConversions
      FROM analytics_events
      WHERE event_ts >= ${startDateOnly}
        AND event_name IN ('trial_started', 'trial_converted')
      GROUP BY DATE_FORMAT(event_ts, '%Y-%m-%d')
      ORDER BY day ASC
    `),
    prisma.$queryRaw<Array<{ cancellations: bigint | number }>>(Prisma.sql`
      SELECT COUNT(*) AS cancellations
      FROM subscription_cancellation_feedback
      WHERE created_at >= ${startDateOnly}
    `),
    prisma.$queryRaw<
      Array<{ reasonCode: string; cancellations: bigint | number }>
    >(Prisma.sql`
      SELECT
        reason_code AS reasonCode,
        COUNT(*) AS cancellations
      FROM subscription_cancellation_feedback
      WHERE created_at >= ${startDateOnly}
      GROUP BY reason_code
      ORDER BY cancellations DESC
      LIMIT 8
    `),
    prisma.$queryRaw<
      Array<{
        id: number;
        userId: number;
        username: string;
        email: string;
        phone: string | null;
        paymentMethod: string | null;
        createdAt: Date;
        reasonCode: string;
        reasonText: string | null;
        source: string | null;
        medium: string | null;
        campaign: string | null;
      }>
    >(Prisma.sql`
      SELECT
        scf.id AS id,
        u.id AS userId,
        u.username AS username,
        u.email AS email,
        u.phone AS phone,
        scf.payment_method AS paymentMethod,
        scf.created_at AS createdAt,
        scf.reason_code AS reasonCode,
        scf.reason_text AS reasonText,
        scf.utm_source AS source,
        scf.utm_medium AS medium,
        scf.utm_campaign AS campaign
      FROM subscription_cancellation_feedback scf
      INNER JOIN users u
        ON u.id = scf.user_id
      WHERE scf.created_at >= ${startDateOnly}
      ORDER BY scf.created_at DESC
      LIMIT ${limit}
    `),
    prisma.$queryRaw<Array<{ involuntaryCancellations: bigint | number }>>(Prisma.sql`
      SELECT
        COUNT(DISTINCT user_id) AS involuntaryCancellations
      FROM analytics_events
      WHERE event_ts >= ${startDateOnly}
        AND event_name = 'subscription_cancel_involuntary'
        AND user_id IS NOT NULL
    `),
    prisma.$queryRaw<Array<{ avgMinutes: bigint | number | null }>>(Prisma.sql`
      SELECT
        AVG(TIMESTAMPDIFF(MINUTE, fp.first_paid_at, fd.first_download_at)) AS avgMinutes
      FROM (
        SELECT user_id, MIN(date_order) AS first_paid_at
        FROM orders
        WHERE status = 1
          AND is_plan = 1
          AND (is_canceled IS NULL OR is_canceled = 0)
        GROUP BY user_id
      ) fp
      INNER JOIN (
        SELECT userId, MIN(date) AS first_download_at
        FROM download_history
        GROUP BY userId
      ) fd
        ON fd.userId = fp.user_id
      WHERE fp.first_paid_at >= ${startDateOnly}
        AND fd.first_download_at >= fp.first_paid_at
    `),
    prisma.$queryRaw<Array<{ avgMinutes: bigint | number | null }>>(Prisma.sql`
      SELECT
        AVG(TIMESTAMPDIFF(MINUTE, u.registered_on, fp.first_paid_at)) AS avgMinutes
      FROM users u
      INNER JOIN (
        SELECT user_id, MIN(date_order) AS first_paid_at
        FROM orders
        WHERE status = 1
          AND is_plan = 1
          AND (is_canceled IS NULL OR is_canceled = 0)
        GROUP BY user_id
      ) fp
        ON fp.user_id = u.id
      WHERE fp.first_paid_at >= ${startDateOnly}
        AND fp.first_paid_at >= u.registered_on
    `),
    prisma.$queryRaw<
      Array<{
        userId: number;
        username: string;
        email: string;
        phone: string | null;
        trialStartedAt: Date;
        planId: bigint | number | null;
      }>
    >(Prisma.sql`
      SELECT
        u.id AS userId,
        u.username AS username,
        u.email AS email,
        u.phone AS phone,
        ae.event_ts AS trialStartedAt,
        NULLIF(CAST(JSON_UNQUOTE(JSON_EXTRACT(ae.metadata_json, '$.planId')) AS UNSIGNED), 0) AS planId
      FROM analytics_events ae
      INNER JOIN users u
        ON u.id = ae.user_id
      LEFT JOIN download_history dh
        ON dh.userId = ae.user_id
        AND dh.date >= ae.event_ts
        AND dh.date < DATE_ADD(ae.event_ts, INTERVAL 24 HOUR)
      WHERE ae.event_ts >= ${startDateOnly}
        AND ae.event_name = 'trial_started'
        AND ae.user_id IS NOT NULL
        AND ae.event_ts < DATE_SUB(NOW(), INTERVAL 24 HOUR)
        AND dh.id IS NULL
      ORDER BY ae.event_ts DESC
      LIMIT ${limit}
    `),
    prisma.$queryRaw<
      Array<{
        userId: number;
        username: string;
        email: string;
        phone: string | null;
        paidAt: Date;
        planId: number | null;
        paymentMethod: string | null;
      }>
    >(Prisma.sql`
      SELECT
        u.id AS userId,
        u.username AS username,
        u.email AS email,
        u.phone AS phone,
        fp.first_paid_at AS paidAt,
        o.plan_id AS planId,
        o.payment_method AS paymentMethod
      FROM (
        SELECT user_id, MIN(date_order) AS first_paid_at
        FROM orders
        WHERE status = 1
          AND is_plan = 1
          AND (is_canceled IS NULL OR is_canceled = 0)
        GROUP BY user_id
      ) fp
      INNER JOIN orders o
        ON o.user_id = fp.user_id
        AND o.date_order = fp.first_paid_at
        AND o.status = 1
        AND o.is_plan = 1
      INNER JOIN users u
        ON u.id = fp.user_id
      LEFT JOIN download_history dh
        ON dh.userId = fp.user_id
        AND dh.date >= fp.first_paid_at
        AND dh.date < DATE_ADD(fp.first_paid_at, INTERVAL 24 HOUR)
      WHERE fp.first_paid_at >= ${startDateOnly}
        AND fp.first_paid_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
      GROUP BY u.id, u.username, u.email, u.phone, fp.first_paid_at, o.plan_id, o.payment_method
      HAVING COUNT(dh.id) = 0
      ORDER BY fp.first_paid_at DESC
      LIMIT ${limit}
    `),
  ]);

  const totalUsers = numberFromUnknown(totalUsersRows?.[0]?.totalUsers);
  const registrationsBefore = numberFromUnknown(
    registrationsBeforeRows?.[0]?.registrationsBefore,
  );

  const registrationsDaily = registrationsDailyRows.map((row) => ({
    day: row.day,
    registrations: numberFromUnknown(row.registrations),
    cumulative: 0,
  }));

  let running = registrationsBefore;
  for (const point of registrationsDaily) {
    running += point.registrations;
    point.cumulative = running;
  }

  const registrations = registrationsDaily.reduce((sum, p) => sum + p.registrations, 0);

  const paidOrders = numberFromUnknown(paidOrdersRows?.[0]?.paidOrders);
  const grossRevenue = roundNumber(numberFromUnknown(paidOrdersRows?.[0]?.grossRevenue), 2);
  const avgOrderValue = paidOrders > 0 ? roundNumber(grossRevenue / paidOrders, 2) : 0;

  const newPaidUsers = numberFromUnknown(newVsRenewalRows?.[0]?.newPaidUsers);
  const renewalOrders = numberFromUnknown(newVsRenewalRows?.[0]?.renewalOrders);

  const trialStarts = numberFromUnknown(trialRows?.[0]?.trialStarts);
  const trialConversions = numberFromUnknown(trialRows?.[0]?.trialConversions);
  const trialConversionRatePct = trialStarts > 0 ? calculateRate(trialConversions, trialStarts) : 0;

  const cancellationsTotal = numberFromUnknown(
    cancellationsTotalRows?.[0]?.cancellations,
  );
  const involuntaryCancellations = numberFromUnknown(
    involuntaryCancellationRows?.[0]?.involuntaryCancellations,
  );

  const activationAvgMinutesRaw = activationAvgRows?.[0]?.avgMinutes;
  const avgMinutesPaidToFirstDownload =
    activationAvgMinutesRaw == null ? null : numberFromUnknown(activationAvgMinutesRaw);
  const avgHoursPaidToFirstDownload =
    avgMinutesPaidToFirstDownload == null || Number.isNaN(avgMinutesPaidToFirstDownload)
      ? null
      : roundNumber(avgMinutesPaidToFirstDownload / 60, 2);

  const registerToPaidAvgMinutesRaw = registerToPaidAvgRows?.[0]?.avgMinutes;
  const avgMinutesRegisterToFirstPaid =
    registerToPaidAvgMinutesRaw == null ? null : numberFromUnknown(registerToPaidAvgMinutesRaw);
  const avgHoursRegisterToFirstPaid =
    avgMinutesRegisterToFirstPaid == null || Number.isNaN(avgMinutesRegisterToFirstPaid)
      ? null
      : roundNumber(avgMinutesRegisterToFirstPaid / 60, 2);

  return {
    range: {
      days,
      start: normalizeDateOutput(startDateOnly),
      end: normalizeDateOutput(new Date()),
    },
    kpis: {
      totalUsers,
      registrations,
      paidOrders,
      newPaidUsers,
      renewalOrders,
      grossRevenue,
      avgOrderValue,
      trialStarts,
      trialConversions,
      trialConversionRatePct,
      cancellations: cancellationsTotal,
      involuntaryCancellations,
      avgHoursPaidToFirstDownload,
      avgHoursRegisterToFirstPaid,
    },
    registrationsDaily,
    trialsDaily: trialDailyRows.map((row) => ({
      day: row.day,
      trialStarts: numberFromUnknown(row.trialStarts),
      trialConversions: numberFromUnknown(row.trialConversions),
    })),
    cancellationTopReasons: cancellationRows.map((row) => ({
      reasonCode: row.reasonCode,
      cancellations: numberFromUnknown(row.cancellations),
    })),
    recentCancellations: recentCancellationRows.map((row) => ({
      id: Number(row.id),
      userId: Number(row.userId),
      username: row.username,
      email: row.email,
      phone: row.phone ?? null,
      paymentMethod: row.paymentMethod ?? null,
      createdAt: normalizeDateOutput(row.createdAt),
      reasonCode: row.reasonCode,
      reasonText: row.reasonText ?? null,
      source: row.source ?? null,
      medium: row.medium ?? null,
      campaign: row.campaign ?? null,
    })),
    trialNoDownload24h: trialNoDownloadRows.map((row) => ({
      userId: Number(row.userId),
      username: row.username,
      email: row.email,
      phone: row.phone ?? null,
      trialStartedAt: normalizeDateOutput(row.trialStartedAt),
      planId: row.planId == null ? null : numberFromUnknown(row.planId),
    })),
    paidNoDownload24h: paidNoDownloadRows.map((row) => ({
      userId: Number(row.userId),
      username: row.username,
      email: row.email,
      phone: row.phone ?? null,
      paidAt: normalizeDateOutput(row.paidAt),
      planId: row.planId == null ? null : Number(row.planId),
      paymentMethod: row.paymentMethod ?? null,
    })),
  };
};

export const getAnalyticsHealthAlerts = async (
  prisma: PrismaClient,
  daysInput?: number,
): Promise<AnalyticsHealthAlertsSnapshot> => {
  const [funnel, business, ux] = await Promise.all([
    getAnalyticsFunnelOverview(prisma, daysInput),
    getAnalyticsBusinessMetrics(prisma, daysInput),
    getAnalyticsUxQuality(prisma, daysInput, 8),
  ]);

  const alerts: AnalyticsHealthAlert[] = [];

  const pushAlert = (alert: AnalyticsHealthAlert) => {
    alerts.push(alert);
  };

  if (funnel.conversion.visitorToRegisterPct < 6) {
    pushAlert({
      id: 'visitor-to-register-critical',
      severity: 'critical',
      title: 'Conversión LP → Registro muy baja',
      message: 'La proporción de visitantes que inicia registro está por debajo del mínimo saludable.',
      metric: 'visitorToRegisterPct',
      value: funnel.conversion.visitorToRegisterPct,
      threshold: 6,
      recommendation:
        'Revisar fricción del formulario (teléfono/captcha), claridad del CTA y velocidad en móvil.',
    });
  } else if (funnel.conversion.visitorToRegisterPct < 10) {
    pushAlert({
      id: 'visitor-to-register-warning',
      severity: 'warning',
      title: 'Conversión LP → Registro en zona de riesgo',
      message: 'Hay espacio de mejora en captación inicial desde tráfico frío.',
      metric: 'visitorToRegisterPct',
      value: funnel.conversion.visitorToRegisterPct,
      threshold: 10,
      recommendation:
        'Probar A/B headline principal, orden de beneficios y reducir campos no esenciales al inicio.',
    });
  }

  if (funnel.conversion.checkoutToPaidPct < 20) {
    pushAlert({
      id: 'checkout-to-paid-critical',
      severity: 'critical',
      title: 'Conversión Checkout → Pago muy baja',
      message: 'Se están perdiendo usuarios al final del embudo de compra.',
      metric: 'checkoutToPaidPct',
      value: funnel.conversion.checkoutToPaidPct,
      threshold: 20,
      recommendation:
        'Auditar errores de pago, orden visual de métodos locales y mensajes de recuperación en fallos.',
    });
  } else if (funnel.conversion.checkoutToPaidPct < 30) {
    pushAlert({
      id: 'checkout-to-paid-warning',
      severity: 'warning',
      title: 'Conversión Checkout → Pago mejorable',
      message: 'El cierre de venta está por debajo del objetivo recomendado.',
      metric: 'checkoutToPaidPct',
      value: funnel.conversion.checkoutToPaidPct,
      threshold: 30,
      recommendation:
        'Simplificar checkout en una pantalla y destacar método de pago más usado por país.',
    });
  }

  if (business.kpis.churnMonthlyPct > 30) {
    pushAlert({
      id: 'churn-critical',
      severity: 'critical',
      title: 'Churn mensual crítico',
      message: 'Una parte alta de pagadores del mes pasado no regresó este mes.',
      metric: 'churnMonthlyPct',
      value: business.kpis.churnMonthlyPct,
      threshold: 30,
      recommendation:
        'Activar secuencia de retención D7/D15 con top descargas, novedades por género y soporte proactivo.',
    });
  } else if (business.kpis.churnMonthlyPct > 18) {
    pushAlert({
      id: 'churn-warning',
      severity: 'warning',
      title: 'Churn mensual en riesgo',
      message: 'La retención mensual necesita intervención para proteger LTV.',
      metric: 'churnMonthlyPct',
      value: business.kpis.churnMonthlyPct,
      threshold: 18,
      recommendation:
        'Medir cohortes por fuente y reforzar activación durante los primeros 10 minutos post-compra.',
    });
  }

  if (business.kpis.refundRatePct > 8) {
    pushAlert({
      id: 'refund-warning',
      severity: 'warning',
      title: 'Tasa de cancelación/reembolso elevada',
      message: 'El volumen de órdenes canceladas supera el umbral recomendado.',
      metric: 'refundRatePct',
      value: business.kpis.refundRatePct,
      threshold: 8,
      recommendation:
        'Revisar expectativas pre-checkout, copy de garantía y causas principales de cancelación.',
    });
  }

  if (ux.totals.poorRatePct > 25) {
    pushAlert({
      id: 'ux-poor-critical',
      severity: 'critical',
      title: 'Experiencia técnica degradada (Web Vitals)',
      message: 'Un porcentaje alto de sesiones reporta métricas en estado “poor”.',
      metric: 'webVitalsPoorRatePct',
      value: ux.totals.poorRatePct,
      threshold: 25,
      recommendation:
        'Priorizar LCP e INP en móvil: optimizar imágenes pesadas, scripts de pago y render de rutas críticas.',
    });
  } else if (ux.totals.poorRatePct > 12) {
    pushAlert({
      id: 'ux-poor-warning',
      severity: 'warning',
      title: 'Web Vitals por arriba del objetivo',
      message: 'Hay fricción técnica que puede estar afectando la conversión.',
      metric: 'webVitalsPoorRatePct',
      value: ux.totals.poorRatePct,
      threshold: 12,
      recommendation:
        'Revisar rutas con peor desempeño y reducir trabajo JavaScript en primer render.',
    });
  }

  if (
    alerts.length === 0 &&
    funnel.conversion.visitorToPaidPct > 0 &&
    business.kpis.churnMonthlyPct <= 12 &&
    ux.totals.poorRatePct <= 12
  ) {
    pushAlert({
      id: 'all-green-info',
      severity: 'info',
      title: 'Embudo saludable',
      message: 'No se detectaron alertas críticas en la ventana analizada.',
      metric: 'visitorToPaidPct',
      value: funnel.conversion.visitorToPaidPct,
      threshold: 0,
      recommendation:
        'Mantener ciclo semanal de experimentos A/B y monitoreo diario de anomalías.',
    });
  }

  return {
    generatedAt: normalizeDateOutput(new Date()),
    alerts,
  };
};

interface AnalyticsCancellationReasonCampaignPoint {
  source: string;
  medium: string;
  campaign: string;
  cancellations: number;
}

interface AnalyticsCancellationReasonPoint {
  reasonCode: string;
  cancellations: number;
  topCampaigns: AnalyticsCancellationReasonCampaignPoint[];
}

interface AnalyticsCancellationReasonsSnapshot {
  range: {
    days: number;
    start: string;
    end: string;
  };
  voluntaryCancellations: number;
  involuntaryCancellations: number;
  totalCancellations: number;
  reasons: AnalyticsCancellationReasonPoint[];
}

const MAX_CANCELLATION_REASON_LIMIT = 30;
const MAX_CANCELLATION_CAMPAIGN_ROWS = 800;
const DEFAULT_CANCELLATION_TOP_CAMPAIGNS = 5;

export const getAnalyticsCancellationReasons = async (
  prisma: PrismaClient,
  daysInput?: number,
  topCampaignsInput?: number,
): Promise<AnalyticsCancellationReasonsSnapshot> => {
  const { days, startDate } = resolveRange(daysInput);

  if (!process.env.DATABASE_URL) {
    return {
      range: {
        days,
        start: normalizeDateOutput(startDate),
        end: normalizeDateOutput(new Date()),
      },
      voluntaryCancellations: 0,
      involuntaryCancellations: 0,
      totalCancellations: 0,
      reasons: [],
    };
  }

  const topCampaigns = topCampaignsInput
    ? Math.max(1, Math.min(10, Math.floor(topCampaignsInput)))
    : DEFAULT_CANCELLATION_TOP_CAMPAIGNS;

  try {
    await ensureAnalyticsEventsTable(prisma);

    const [reasonRows, campaignRows, involuntaryRows] = await Promise.all([
      prisma.$queryRaw<
      Array<{
        reasonCode: string;
        cancellations: bigint | number;
      }>
    >(Prisma.sql`
      SELECT
        reason_code AS reasonCode,
        COUNT(*) AS cancellations
      FROM subscription_cancellation_feedback
      WHERE created_at >= ${startDate}
      GROUP BY reason_code
      ORDER BY cancellations DESC
      LIMIT ${MAX_CANCELLATION_REASON_LIMIT}
    `),
      prisma.$queryRaw<
      Array<{
        reasonCode: string;
        source: string | null;
        medium: string | null;
        campaign: string | null;
        cancellations: bigint | number;
      }>
    >(Prisma.sql`
      SELECT
        reason_code AS reasonCode,
        COALESCE(NULLIF(utm_source, ''), 'direct') AS source,
        COALESCE(NULLIF(utm_medium, ''), 'none') AS medium,
        COALESCE(NULLIF(utm_campaign, ''), '(none)') AS campaign,
        COUNT(*) AS cancellations
      FROM subscription_cancellation_feedback
      WHERE created_at >= ${startDate}
      GROUP BY reason_code, source, medium, campaign
      ORDER BY cancellations DESC
      LIMIT ${MAX_CANCELLATION_CAMPAIGN_ROWS}
    `),
      prisma.$queryRaw<Array<{ involuntaryCancellations: bigint | number }>>(Prisma.sql`
        SELECT
          COUNT(DISTINCT user_id) AS involuntaryCancellations
        FROM analytics_events
        WHERE event_ts >= ${startDate}
          AND event_name = 'subscription_cancel_involuntary'
          AND user_id IS NOT NULL
      `),
    ]);

    const voluntaryCancellations = reasonRows.reduce(
      (acc, row) => acc + numberFromUnknown(row.cancellations),
      0,
    );
    const involuntaryCancellations = numberFromUnknown(
      involuntaryRows?.[0]?.involuntaryCancellations,
    );
    const totalCancellations = voluntaryCancellations + involuntaryCancellations;

    const campaignByReason = campaignRows.reduce((map, row) => {
      const reasonCode = row.reasonCode || 'unknown';
      const list = map.get(reasonCode) ?? [];
      list.push({
        source: row.source || 'direct',
        medium: row.medium || 'none',
        campaign: row.campaign || '(none)',
        cancellations: numberFromUnknown(row.cancellations),
      });
      map.set(reasonCode, list);
      return map;
    }, new Map<string, AnalyticsCancellationReasonCampaignPoint[]>());

    const reasons = reasonRows.map((row) => {
      const reasonCode = row.reasonCode || 'unknown';
      const campaigns = campaignByReason.get(reasonCode) ?? [];
      campaigns.sort((a, b) => b.cancellations - a.cancellations);
      return {
        reasonCode,
        cancellations: numberFromUnknown(row.cancellations),
        topCampaigns: campaigns.slice(0, topCampaigns),
      };
    });

    return {
      range: {
        days,
        start: normalizeDateOutput(startDate),
        end: normalizeDateOutput(new Date()),
      },
      voluntaryCancellations,
      involuntaryCancellations,
      totalCancellations,
      reasons,
    };
  } catch (error) {
    // If the table is not present yet (migration pending) or query fails, return a safe empty payload.
    return {
      range: {
        days,
        start: normalizeDateOutput(startDate),
        end: normalizeDateOutput(new Date()),
      },
      voluntaryCancellations: 0,
      involuntaryCancellations: 0,
      totalCancellations: 0,
      reasons: [],
    };
  }
};

interface AnalyticsLiveEventPoint {
  ts: string;
  name: string;
  pagePath: string | null;
  visitorId: string | null;
  sessionId: string | null;
  userId: number | null;
  source: string | null;
  medium: string | null;
  campaign: string | null;
}

interface AnalyticsLiveSnapshot {
  window: {
    minutes: number;
    start: string;
    end: string;
  };
  activeVisitors: number;
  activeSessions: number;
  activeCheckouts: number;
  events: AnalyticsLiveEventPoint[];
}

const DEFAULT_LIVE_WINDOW_MINUTES = 10;
const DEFAULT_LIVE_LIMIT = 200;
const MAX_LIVE_LIMIT = 500;
const MAX_LIVE_WINDOW_MINUTES = 120;

export const getAnalyticsLiveSnapshot = async (
  prisma: PrismaClient,
  minutesInput?: number,
  limitInput?: number,
): Promise<AnalyticsLiveSnapshot> => {
  const minutes = minutesInput
    ? Math.max(1, Math.min(MAX_LIVE_WINDOW_MINUTES, Math.floor(minutesInput)))
    : DEFAULT_LIVE_WINDOW_MINUTES;
  const limit = limitInput
    ? Math.max(1, Math.min(MAX_LIVE_LIMIT, Math.floor(limitInput)))
    : DEFAULT_LIVE_LIMIT;

  const now = new Date();
  const windowStart = new Date(now.getTime() - minutes * 60 * 1000);

  if (!process.env.DATABASE_URL) {
    return {
      window: {
        minutes,
        start: normalizeDateOutput(windowStart),
        end: normalizeDateOutput(now),
      },
      activeVisitors: 0,
      activeSessions: 0,
      activeCheckouts: 0,
      events: [],
    };
  }

  await ensureAnalyticsEventsTable(prisma);

  const [activityRows, checkoutRows, eventRows] = await Promise.all([
    prisma.$queryRaw<
      Array<{
        activeVisitors: bigint | number;
        activeSessions: bigint | number;
      }>
    >(Prisma.sql`
      SELECT
        COUNT(DISTINCT COALESCE(visitor_id, session_id, CONCAT('anon:', event_id))) AS activeVisitors,
        COUNT(DISTINCT session_id) AS activeSessions
      FROM analytics_events
      WHERE event_ts >= ${windowStart}
    `),
    prisma.$queryRaw<
      Array<{
        activeCheckouts: bigint | number;
      }>
    >(Prisma.sql`
      SELECT
        COUNT(DISTINCT checkout.session_id) AS activeCheckouts
      FROM (
        SELECT session_id
        FROM analytics_events
        WHERE event_ts >= ${windowStart}
          AND event_name = 'checkout_started'
          AND session_id IS NOT NULL
        GROUP BY session_id
      ) checkout
      LEFT JOIN (
        SELECT session_id
        FROM analytics_events
        WHERE event_ts >= ${windowStart}
          AND event_name = 'payment_success'
          AND session_id IS NOT NULL
        GROUP BY session_id
      ) paid ON paid.session_id = checkout.session_id
      WHERE paid.session_id IS NULL
    `),
    prisma.$queryRaw<
      Array<{
        eventTs: Date | string;
        eventName: string;
        pagePath: string | null;
        visitorId: string | null;
        sessionId: string | null;
        userId: number | null;
        source: string | null;
        medium: string | null;
        campaign: string | null;
      }>
    >(Prisma.sql`
      SELECT
        event_ts AS eventTs,
        event_name AS eventName,
        page_path AS pagePath,
        visitor_id AS visitorId,
        session_id AS sessionId,
        user_id AS userId,
        utm_source AS source,
        utm_medium AS medium,
        utm_campaign AS campaign
      FROM analytics_events
      WHERE event_ts >= ${windowStart}
      ORDER BY event_ts DESC
      LIMIT ${limit}
    `),
  ]);

  const activity = activityRows[0];
  const checkout = checkoutRows[0];

  return {
    window: {
      minutes,
      start: normalizeDateOutput(windowStart),
      end: normalizeDateOutput(now),
    },
    activeVisitors: numberFromUnknown(activity?.activeVisitors ?? 0),
    activeSessions: numberFromUnknown(activity?.activeSessions ?? 0),
    activeCheckouts: numberFromUnknown(checkout?.activeCheckouts ?? 0),
    events: eventRows.map((row) => {
      const tsValue = row.eventTs instanceof Date ? row.eventTs : new Date(row.eventTs);
      return {
        ts: normalizeDateOutput(tsValue),
        name: row.eventName,
        pagePath: row.pagePath,
        visitorId: row.visitorId,
        sessionId: row.sessionId,
        userId: row.userId,
        source: row.source,
        medium: row.medium,
        campaign: row.campaign,
      };
    }),
  };
};
