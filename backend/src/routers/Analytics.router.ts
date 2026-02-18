import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import {
  ANALYTICS_PUBLIC_TRAFFIC_FILTER_AE_SQL,
  analyticsEventBatchSchema,
  backfillAnalyticsUserIdentity,
  ensureAnalyticsEventsTableExists,
  getAnalyticsBusinessMetrics,
  getAnalyticsCancellationReasons,
  getAnalyticsCrmDashboard,
  getAnalyticsHealthAlerts,
  getAnalyticsLiveSnapshot,
  getAnalyticsTopEvents,
  getAnalyticsAttributionBreakdown,
  getAnalyticsDailySeries,
  getAnalyticsFunnelOverview,
  getAnalyticsUxQuality,
  getClientIpFromRequest,
  ingestAnalyticsEvents,
} from '../analytics';
import { manyChat } from '../many-chat';
import { OFFER_KEYS, upsertUserOfferAndCoupon } from '../offers';
import { publicProcedure } from '../procedures/public.procedure';
import { shieldedProcedure } from '../procedures/shielded.procedure';
import { RolesNames } from './auth/interfaces/roles.interface';
import { router } from '../trpc';
import { createAdminAuditLog } from './utils/adminAuditLog';

const analyticsRangeInputSchema = z
  .object({
    days: z.number().int().min(1).max(365).optional(),
  })
  .optional();

const analyticsAttributionInputSchema = z
  .object({
    days: z.number().int().min(1).max(365).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    page: z.number().int().min(0).max(5000).optional(),
  })
  .optional();

const analyticsBusinessInputSchema = z
  .object({
    days: z.number().int().min(1).max(365).optional(),
    adSpend: z.number().min(0).max(999999999).optional(),
  })
  .optional();

const analyticsAdSpendMonthlyInputSchema = z
  .object({
    month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  })
  .optional();

const analyticsAdSpendMonthlyUpsertSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/),
  channel: z.string().trim().min(1).max(80),
  currency: z.enum(['MXN', 'USD']).default('MXN'),
  amount: z.number().min(0).max(999999999),
});

const analyticsAdSpendMonthlyDeleteSchema = z.object({
  id: z.number().int().positive(),
});

const analyticsUxInputSchema = z
  .object({
    days: z.number().int().min(1).max(365).optional(),
    routesLimit: z.number().int().min(3).max(100).optional(),
    routesPage: z.number().int().min(0).max(5000).optional(),
  })
  .optional();

const analyticsTopEventsInputSchema = z
  .object({
    days: z.number().int().min(1).max(365).optional(),
    limit: z.number().int().min(5).max(100).optional(),
    page: z.number().int().min(0).max(5000).optional(),
  })
  .optional();

const analyticsAlertsInputSchema = z
  .object({
    days: z.number().int().min(1).max(365).optional(),
  })
  .optional();

const analyticsCancellationReasonsInputSchema = z
  .object({
    days: z.number().int().min(1).max(365).optional(),
    topCampaigns: z.number().int().min(1).max(10).optional(),
  })
  .optional();

const analyticsLiveSnapshotInputSchema = z
  .object({
    minutes: z.number().int().min(1).max(1440).optional(),
    limit: z.number().int().min(1).max(500).optional(),
    page: z.number().int().min(0).max(5000).optional(),
  })
  .optional();

const analyticsIdentifyInputSchema = z
  .object({
    sessionId: z.string().max(80).optional().nullable(),
    visitorId: z.string().max(80).optional().nullable(),
    lookbackHours: z.number().int().min(1).max(72).optional(),
  })
  .refine(
    (value) =>
      Boolean(
        `${value.sessionId ?? ''}`.trim() || `${value.visitorId ?? ''}`.trim(),
      ),
    { message: 'sessionId o visitorId son requeridos' },
  );

const analyticsCrmDashboardInputSchema = z
  .object({
    days: z.number().int().min(1).max(365).optional(),
    limit: z.number().int().min(10).max(100).optional(),
    recentCancellationsPage: z.number().int().min(0).max(5000).optional(),
    trialNoDownloadPage: z.number().int().min(0).max(5000).optional(),
    paidNoDownload2hPage: z.number().int().min(0).max(5000).optional(),
    paidNoDownloadPage: z.number().int().min(0).max(5000).optional(),
  })
  .optional();

const automationStatusInputSchema = z
  .object({
    runsLimit: z.number().int().min(1).max(50).optional(),
  })
  .optional();

const adminManyChatTagInputSchema = z.object({
  userId: z.number().int().positive(),
  tagName: z.string().min(1).max(120),
});

const adminOfferInputSchema = z.object({
  userId: z.number().int().positive(),
  percentOff: z.number().int().min(5).max(80),
  expiresHours: z.number().int().min(1).max(720).optional(),
});

const adminMarkContactedInputSchema = z.object({
  userId: z.number().int().positive(),
  note: z.string().max(500).optional(),
});

const assertAdminRole = (role?: string): void => {
  if (role !== RolesNames.admin) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Solo admin puede acceder a analytics',
    });
  }
};

const getCurrentMonthKey = (): string => {
  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}`;
};

const parseMonthKeyRange = (monthKeyRaw: string): { start: Date; end: Date; monthKey: string } => {
  const trimmed = (monthKeyRaw || '').trim();
  const match = /^(\d{4})-(\d{2})$/.exec(trimmed);
  if (!match) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El mes debe tener formato YYYY-MM',
    });
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || month < 1 || month > 12) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El mes es inválido',
    });
  }

  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  return { start, end, monthKey };
};

export const analyticsRouter = router({
  trackAnalyticsEvents: publicProcedure
    .input(analyticsEventBatchSchema)
    .mutation(async ({ ctx, input }) => {
      if (!process.env.DATABASE_URL) {
        return {
          accepted: 0,
          skipped: true,
          reason: 'analytics-db-not-configured',
        };
      }

      const sessionUserId = ctx.session?.user?.id ?? null;
      const userAgent = ctx.req.headers['user-agent'];
      const clientIp = getClientIpFromRequest(ctx.req);
      const result = await ingestAnalyticsEvents({
        prisma: ctx.prisma,
        events: input.events,
        sessionUserId,
        clientIp,
        userAgent: typeof userAgent === 'string' ? userAgent : null,
      });

      return {
        accepted: result.accepted,
      };
    }),
  identifyAnalyticsUser: publicProcedure
    .input(analyticsIdentifyInputSchema)
    .mutation(async ({ ctx, input }) => {
      if (!process.env.DATABASE_URL) {
        return {
          updated: 0,
          skipped: true,
          reason: 'analytics-db-not-configured',
        };
      }

      const userId = ctx.session?.user?.id ?? null;
      if (!userId) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Sesión requerida para identificar analytics',
        });
      }

      const result = await backfillAnalyticsUserIdentity({
        prisma: ctx.prisma,
        userId,
        sessionId: input.sessionId,
        visitorId: input.visitorId,
        lookbackHours: input.lookbackHours,
      });

      return {
        updated: result.updated,
        lookbackHours: result.lookbackHours,
      };
    }),
  getAnalyticsFunnelOverview: shieldedProcedure
    .input(analyticsRangeInputSchema)
    .query(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);
      return getAnalyticsFunnelOverview(ctx.prisma, input?.days);
    }),
  getAnalyticsDailySeries: shieldedProcedure
    .input(analyticsRangeInputSchema)
    .query(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);
      return getAnalyticsDailySeries(ctx.prisma, input?.days);
    }),
  getAnalyticsAttribution: shieldedProcedure
    .input(analyticsAttributionInputSchema)
    .query(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);
      return getAnalyticsAttributionBreakdown(
        ctx.prisma,
        input?.days,
        input?.limit,
        input?.page,
      );
    }),
  getAnalyticsBusinessMetrics: shieldedProcedure
    .input(analyticsBusinessInputSchema)
    .query(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);
      return getAnalyticsBusinessMetrics(
        ctx.prisma,
        input?.days,
        input?.adSpend,
      );
    }),
  getAnalyticsAdSpendMonthly: shieldedProcedure
    .input(analyticsAdSpendMonthlyInputSchema)
    .query(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);
      const { start, end, monthKey } = parseMonthKeyRange(
        input?.month ?? getCurrentMonthKey(),
      );

      const [spendRows, acquisitionRows] = await Promise.all([
        ctx.prisma.adSpendMonthly.findMany({
          where: { month_key: monthKey },
          orderBy: [{ channel: 'asc' }, { currency: 'asc' }],
        }),
        (async () => {
          if (!process.env.DATABASE_URL) return [];
          await ensureAnalyticsEventsTableExists(ctx.prisma);

          const isRenewalFalseSql = Prisma.sql`
            LOWER(
              COALESCE(
                JSON_UNQUOTE(JSON_EXTRACT(ae.metadata_json, '$.isRenewal')),
                JSON_UNQUOTE(JSON_EXTRACT(ae.metadata_json, '$.is_renewal')),
                'false'
              )
            ) = 'false'
          `;

          const rows = await ctx.prisma.$queryRaw<
            Array<{
              channel: string;
              newPaidUsers: bigint | number;
            }>
          >(Prisma.sql`
            SELECT
              COALESCE(NULLIF(TRIM(ae.utm_source), ''), '(direct)') AS channel,
              COUNT(DISTINCT ae.user_id) AS newPaidUsers
            FROM analytics_events ae
            INNER JOIN (
              SELECT
                ae.user_id AS user_id,
                MIN(ae.event_ts) AS first_ts
              FROM analytics_events ae
              WHERE ae.user_id IS NOT NULL
                AND ae.event_name = 'payment_success'
                AND ${isRenewalFalseSql}
                ${ANALYTICS_PUBLIC_TRAFFIC_FILTER_AE_SQL}
              GROUP BY ae.user_id
            ) first_pay
              ON first_pay.user_id = ae.user_id
              AND first_pay.first_ts = ae.event_ts
            WHERE ae.user_id IS NOT NULL
              AND ae.event_name = 'payment_success'
              AND ${isRenewalFalseSql}
              AND ae.event_ts >= ${start}
              AND ae.event_ts < ${end}
              ${ANALYTICS_PUBLIC_TRAFFIC_FILTER_AE_SQL}
            GROUP BY channel
            ORDER BY newPaidUsers DESC
            LIMIT 200
          `);

          return rows;
        })(),
      ]);

      const numberFromUnknown = (value: unknown): number => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'bigint') return Number(value);
        if (typeof value === 'string') {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
      };

      return {
        month: monthKey,
        range: { start: start.toISOString(), end: end.toISOString() },
        spend: spendRows.map((row) => ({
          id: row.id,
          month: row.month_key,
          channel: row.channel,
          currency: row.currency,
          amount: Number(row.amount),
          createdAt: row.created_at.toISOString(),
          updatedAt: row.updated_at.toISOString(),
        })),
        acquisition: acquisitionRows.map((row) => ({
          channel: row.channel,
          newPaidUsers: numberFromUnknown(row.newPaidUsers),
        })),
      };
    }),
  upsertAnalyticsAdSpendMonthly: shieldedProcedure
    .input(analyticsAdSpendMonthlyUpsertSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);
      const { monthKey } = parseMonthKeyRange(input.month);
      const channel = input.channel.trim();
      const currency = input.currency.toUpperCase();

      const row = await ctx.prisma.adSpendMonthly.upsert({
        where: {
          month_key_channel_currency: {
            month_key: monthKey,
            channel,
            currency,
          },
        },
        create: {
          month_key: monthKey,
          channel,
          currency,
          amount: input.amount,
        },
        update: {
          amount: input.amount,
        },
      });

      await createAdminAuditLog({
        prisma: ctx.prisma,
        actorUserId: ctx.session!.user!.id,
        action: 'upsert_ad_spend_monthly',
        req: ctx.req,
        metadata: {
          month: monthKey,
          channel,
          currency,
          amount: input.amount,
        },
      });

      return {
        id: row.id,
        month: row.month_key,
        channel: row.channel,
        currency: row.currency,
        amount: Number(row.amount),
        createdAt: row.created_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
      };
    }),
  deleteAnalyticsAdSpendMonthly: shieldedProcedure
    .input(analyticsAdSpendMonthlyDeleteSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);
      const existing = await ctx.prisma.adSpendMonthly.findUnique({
        where: { id: input.id },
      });
      if (!existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Registro no encontrado',
        });
      }

      await ctx.prisma.adSpendMonthly.delete({ where: { id: input.id } });

      await createAdminAuditLog({
        prisma: ctx.prisma,
        actorUserId: ctx.session!.user!.id,
        action: 'delete_ad_spend_monthly',
        req: ctx.req,
        metadata: {
          id: input.id,
          month: existing.month_key,
          channel: existing.channel,
          currency: existing.currency,
        },
      });

      return { deleted: true };
    }),
  getAnalyticsUxQuality: shieldedProcedure
    .input(analyticsUxInputSchema)
    .query(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);
      return getAnalyticsUxQuality(
        ctx.prisma,
        input?.days,
        input?.routesLimit,
        input?.routesPage,
      );
    }),
  getAnalyticsTopEvents: shieldedProcedure
    .input(analyticsTopEventsInputSchema)
    .query(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);
      return getAnalyticsTopEvents(
        ctx.prisma,
        input?.days,
        input?.limit,
        input?.page,
      );
    }),
  getAnalyticsAlerts: shieldedProcedure
    .input(analyticsAlertsInputSchema)
    .query(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);
      return getAnalyticsHealthAlerts(ctx.prisma, input?.days);
    }),
  getAnalyticsCancellationReasons: shieldedProcedure
    .input(analyticsCancellationReasonsInputSchema)
    .query(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);
      return getAnalyticsCancellationReasons(
        ctx.prisma,
        input?.days,
        input?.topCampaigns,
      );
    }),
  getAnalyticsLiveSnapshot: shieldedProcedure
    .input(analyticsLiveSnapshotInputSchema)
    .query(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);
      return getAnalyticsLiveSnapshot(
        ctx.prisma,
        input?.minutes,
        input?.limit,
        input?.page,
      );
    }),
  getAnalyticsCrmDashboard: shieldedProcedure
    .input(analyticsCrmDashboardInputSchema)
    .query(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);
      return getAnalyticsCrmDashboard(ctx.prisma, input?.days, input?.limit, {
        recentCancellationsPage: input?.recentCancellationsPage,
        trialNoDownloadPage: input?.trialNoDownloadPage,
        paidNoDownload2hPage: input?.paidNoDownload2hPage,
        paidNoDownloadPage: input?.paidNoDownloadPage,
      });
    }),
  getAutomationStatus: shieldedProcedure
    .input(automationStatusInputSchema)
    .query(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);
      const runsLimit = input?.runsLimit ?? 20;
      const numberFromUnknown = (value: unknown): number => {
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'bigint') return Number(value);
        if (typeof value === 'string') {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
      };
      const runs = await ctx.prisma.automationRunLog.findMany({
        orderBy: { started_at: 'desc' },
        take: runsLimit,
      });

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const [actionsLast24h, actionBreakdownRows, checkoutAbandonedRows] = await Promise.all([
        ctx.prisma.automationActionLog.count({
          where: { sent_at: { gte: since } },
        }),
        ctx.prisma.$queryRaw<
          Array<{
            actionKey: string;
            channel: string;
            total: number | bigint;
          }>
        >(Prisma.sql`
          SELECT
            action_key AS actionKey,
            channel AS channel,
            COUNT(*) AS total
          FROM automation_action_logs
          WHERE sent_at >= ${since}
          GROUP BY action_key, channel
          ORDER BY total DESC
          LIMIT 50
        `),
        ctx.prisma.$queryRaw<
          Array<{
            journeys: number | bigint;
            emailSent: number | bigint;
            whatsappSent: number | bigint;
            manychatTagged: number | bigint;
            recoveredUsers: number | bigint;
          }>
        >(Prisma.sql`
          SELECT
            SUM(CASE WHEN aal.action_key = 'checkout_abandoned' THEN 1 ELSE 0 END) AS journeys,
            SUM(CASE WHEN aal.action_key = 'checkout_abandoned_email' THEN 1 ELSE 0 END) AS emailSent,
            SUM(CASE WHEN aal.action_key = 'checkout_abandoned_whatsapp' THEN 1 ELSE 0 END) AS whatsappSent,
            SUM(CASE WHEN aal.action_key = 'checkout_abandoned_manychat' THEN 1 ELSE 0 END) AS manychatTagged,
            COUNT(DISTINCT CASE
              WHEN aal.action_key = 'checkout_abandoned'
                AND EXISTS (
                  SELECT 1
                  FROM orders o
                  WHERE o.user_id = aal.user_id
                    AND o.status = 1
                    AND o.is_plan = 1
                    AND (o.is_canceled IS NULL OR o.is_canceled = 0)
                    AND o.date_order > aal.sent_at
                )
              THEN aal.user_id
            END) AS recoveredUsers
          FROM automation_action_logs aal
          WHERE aal.sent_at >= ${since}
        `),
      ]);

      return {
        actionsLast24h,
        actionBreakdownLast24h: actionBreakdownRows.map((row) => ({
          actionKey: row.actionKey,
          channel: row.channel,
          total: numberFromUnknown(row.total),
        })),
        checkoutAbandonedLast24h: {
          journeys: numberFromUnknown(checkoutAbandonedRows[0]?.journeys),
          emailSent: numberFromUnknown(checkoutAbandonedRows[0]?.emailSent),
          whatsappSent: numberFromUnknown(checkoutAbandonedRows[0]?.whatsappSent),
          manychatTagged: numberFromUnknown(checkoutAbandonedRows[0]?.manychatTagged),
          recoveredUsers: numberFromUnknown(checkoutAbandonedRows[0]?.recoveredUsers),
        },
        recentRuns: runs.map((run) => ({
          id: run.id,
          startedAt: run.started_at.toISOString(),
          finishedAt: run.finished_at ? run.finished_at.toISOString() : null,
          status: run.status,
          error: run.error ?? null,
        })),
      };
    }),
  adminAddManyChatTag: shieldedProcedure
    .input(adminManyChatTagInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);
      const user = await ctx.prisma.users.findFirst({
        where: { id: input.userId },
      });
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Usuario no encontrado',
        });
      }

      await manyChat.addTagToUser(user, input.tagName);

      // Best-effort log (do not block UI).
      try {
        await ctx.prisma.automationActionLog.create({
          data: {
            user_id: user.id,
            action_key: 'admin_manychat_tag',
            stage: Math.floor(Date.now() / 1000),
            channel: 'admin',
            metadata_json: { tagName: input.tagName },
          },
        });
      } catch {
        // noop
      }

      return { ok: true };
    }),
  adminCreateOffer: shieldedProcedure
    .input(adminOfferInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);
      const user = await ctx.prisma.users.findFirst({
        where: { id: input.userId },
      });
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Usuario no encontrado',
        });
      }

      const expiresHours = input.expiresHours ?? 72;
      const expiresAt = new Date(Date.now() + expiresHours * 60 * 60 * 1000);

      const offer = await upsertUserOfferAndCoupon({
        prisma: ctx.prisma,
        userId: user.id,
        offerKey: OFFER_KEYS.PLANS_NO_CHECKOUT,
        stage: input.percentOff,
        percentOff: input.percentOff,
        expiresAt,
      });

      // Best-effort: push offer info into ManyChat for sequences to use.
      try {
        const mcId = await manyChat.getManyChatId(user);
        if (mcId) {
          manyChat
            .setCustomField(mcId, 'bb_offer_code', offer.couponCode ?? '')
            .catch(() => {});
          manyChat
            .setCustomField(mcId, 'bb_offer_pct', String(offer.percentOff))
            .catch(() => {});
          manyChat
            .setCustomField(
              mcId,
              'bb_offer_expires_at',
              expiresAt.toISOString(),
            )
            .catch(() => {});
        }
      } catch {
        // noop
      }

      const offerTag =
        input.percentOff >= 50
          ? 'AUTOMATION_PLANS_OFFER_50'
          : input.percentOff >= 30
            ? 'AUTOMATION_PLANS_OFFER_30'
            : 'AUTOMATION_PLANS_OFFER_10';
      await manyChat.addTagToUser(user, offerTag);

      // Idempotency log (stage = percentOff).
      try {
        await ctx.prisma.automationActionLog.create({
          data: {
            user_id: user.id,
            action_key: 'admin_offer',
            stage: input.percentOff,
            channel: 'admin',
            metadata_json: {
              offerKey: OFFER_KEYS.PLANS_NO_CHECKOUT,
              percentOff: input.percentOff,
              expiresAt: expiresAt.toISOString(),
              couponCode: offer.couponCode ?? null,
            },
          },
        });
      } catch {
        // noop
      }

      return {
        ok: true,
        couponCode: offer.couponCode,
        percentOff: offer.percentOff,
        expiresAt: expiresAt.toISOString(),
      };
    }),
  adminMarkContacted: shieldedProcedure
    .input(adminMarkContactedInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);
      const user = await ctx.prisma.users.findFirst({
        where: { id: input.userId },
      });
      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Usuario no encontrado',
        });
      }

      await ctx.prisma.automationActionLog.create({
        data: {
          user_id: user.id,
          action_key: 'admin_contacted',
          stage: Math.floor(Date.now() / 1000),
          channel: 'admin',
          metadata_json: input.note ? { note: input.note } : undefined,
        },
      });

      return { ok: true };
    }),
});
