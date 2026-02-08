import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import {
  analyticsEventBatchSchema,
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
    limit: z.number().int().min(1).max(40).optional(),
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
    routesLimit: z.number().int().min(3).max(50).optional(),
  })
  .optional();

const analyticsTopEventsInputSchema = z
  .object({
    days: z.number().int().min(7).max(365).optional(),
    limit: z.number().int().min(5).max(60).optional(),
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
  })
  .optional();

const analyticsCrmDashboardInputSchema = z
  .object({
    days: z.number().int().min(7).max(365).optional(),
    limit: z.number().int().min(10).max(300).optional(),
  })
  .optional();

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
      );
    }),
  getAnalyticsBusinessMetrics: shieldedProcedure
    .input(analyticsBusinessInputSchema)
    .query(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);
      return getAnalyticsBusinessMetrics(ctx.prisma, input?.days, input?.adSpend);
    }),
  getAnalyticsUxQuality: shieldedProcedure
    .input(analyticsUxInputSchema)
    .query(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);
      return getAnalyticsUxQuality(ctx.prisma, input?.days, input?.routesLimit);
    }),
  getAnalyticsTopEvents: shieldedProcedure
    .input(analyticsTopEventsInputSchema)
    .query(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);
      return getAnalyticsTopEvents(ctx.prisma, input?.days, input?.limit);
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
      return getAnalyticsLiveSnapshot(ctx.prisma, input?.minutes, input?.limit);
    }),
  getAnalyticsCrmDashboard: shieldedProcedure
    .input(analyticsCrmDashboardInputSchema)
    .query(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);
      return getAnalyticsCrmDashboard(ctx.prisma, input?.days, input?.limit);
    }),
});
