import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  analyticsEventBatchSchema,
  backfillAnalyticsUserIdentity,
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

const analyticsRangeInputSchema = z
  .object({
    days: z.number().int().min(7).max(365).optional(),
  })
  .optional();

const analyticsAttributionInputSchema = z
  .object({
    days: z.number().int().min(7).max(365).optional(),
    limit: z.number().int().min(1).max(100).optional(),
    page: z.number().int().min(0).max(5000).optional(),
  })
  .optional();

const analyticsBusinessInputSchema = z
  .object({
    days: z.number().int().min(7).max(365).optional(),
    adSpend: z.number().min(0).max(999999999).optional(),
  })
  .optional();

const analyticsUxInputSchema = z
  .object({
    days: z.number().int().min(7).max(365).optional(),
    routesLimit: z.number().int().min(3).max(100).optional(),
    routesPage: z.number().int().min(0).max(5000).optional(),
  })
  .optional();

const analyticsTopEventsInputSchema = z
  .object({
    days: z.number().int().min(7).max(365).optional(),
    limit: z.number().int().min(5).max(100).optional(),
    page: z.number().int().min(0).max(5000).optional(),
  })
  .optional();

const analyticsAlertsInputSchema = z
  .object({
    days: z.number().int().min(7).max(365).optional(),
  })
  .optional();

const analyticsCancellationReasonsInputSchema = z
  .object({
    days: z.number().int().min(7).max(365).optional(),
    topCampaigns: z.number().int().min(1).max(10).optional(),
  })
  .optional();

const analyticsLiveSnapshotInputSchema = z
  .object({
    minutes: z.number().int().min(1).max(120).optional(),
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
    days: z.number().int().min(7).max(365).optional(),
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
      const runs = await ctx.prisma.automationRunLog.findMany({
        orderBy: { started_at: 'desc' },
        take: runsLimit,
      });

      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const actionsLast24h = await ctx.prisma.automationActionLog.count({
        where: { sent_at: { gte: since } },
      });

      return {
        actionsLast24h,
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
