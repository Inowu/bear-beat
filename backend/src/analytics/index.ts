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
      COUNT(CASE WHEN event_name = 'payment_success' THEN 1 END) AS purchases
    FROM analytics_events
    WHERE event_ts >= ${startDate}
    GROUP BY source, medium, campaign
    ORDER BY purchases DESC, registrations DESC, visitors DESC
    LIMIT ${limit}
  `);

  return rows.map((row) => ({
    source: row.source || 'direct',
    medium: row.medium || 'none',
    campaign: row.campaign || '(none)',
    visitors: numberFromUnknown(row.visitors),
    registrations: numberFromUnknown(row.registrations),
    checkouts: numberFromUnknown(row.checkouts),
    purchases: numberFromUnknown(row.purchases),
  }));
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
