import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { enqueueWebhookInboxJob } from '../../queue/webhookInbox';
import { publicProcedure } from '../../procedures/public.procedure';
import { router } from '../../trpc';
import { RolesNames } from '../auth/interfaces/roles.interface';

const listWebhookInboxInputSchema = z
  .object({
    provider: z.string().trim().max(32).optional(),
    status: z.string().trim().max(20).optional(),
    q: z.string().trim().max(191).optional(),
    limit: z.number().int().min(1).max(200).optional(),
    cursor: z.number().int().positive().optional(),
  })
  .optional();

const getWebhookInboxInputSchema = z.object({
  id: z.number().int().positive(),
});

const retryWebhookInboxInputSchema = z.object({
  id: z.number().int().positive(),
});

const RETRYABLE_STATUSES = ['FAILED', 'IGNORED'] as const;

const assertAdminRole = (role?: string): void => {
  if (role !== RolesNames.admin) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Solo admin puede acceder a webhook inbox',
    });
  }
};

export const adminWebhookInboxRouter = router({
  list: publicProcedure
    .input(listWebhookInboxInputSchema)
    .query(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);

      const provider = input?.provider?.trim();
      const status = input?.status?.trim();
      const q = input?.q?.trim();
      const limit = input?.limit ?? 200;
      const cursor = input?.cursor;

      const where: {
        provider?: string;
        status?: string;
        id?: { lt: number };
        OR?: Array<{
          event_type?: { contains: string };
          event_id?: { contains: string };
        }>;
      } = {};

      if (provider) where.provider = provider;
      if (status) where.status = status;
      if (cursor) where.id = { lt: cursor };
      if (q) {
        where.OR = [
          { event_type: { contains: q } },
          { event_id: { contains: q } },
        ];
      }

      const rows = await ctx.prisma.webhookInboxEvent.findMany({
        where,
        take: limit,
        orderBy: {
          id: 'desc',
        },
        select: {
          id: true,
          provider: true,
          event_id: true,
          event_type: true,
          status: true,
          attempts: true,
          received_at: true,
          processed_at: true,
          last_error: true,
        },
      });

      const items = rows.map((row) => ({
        id: row.id,
        provider: row.provider,
        eventId: row.event_id,
        eventType: row.event_type,
        status: row.status,
        attempts: row.attempts,
        receivedAt: row.received_at.toISOString(),
        processedAt: row.processed_at ? row.processed_at.toISOString() : null,
        lastError: row.last_error ?? null,
      }));

      const nextCursor = rows.length === limit ? rows[rows.length - 1]?.id ?? null : null;

      return {
        items,
        nextCursor,
      };
    }),

  get: publicProcedure
    .input(getWebhookInboxInputSchema)
    .query(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);

      const row = await ctx.prisma.webhookInboxEvent.findUnique({
        where: { id: input.id },
      });

      if (!row) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Evento de webhook inbox no encontrado',
        });
      }

      return {
        id: row.id,
        provider: row.provider,
        eventId: row.event_id,
        eventType: row.event_type,
        livemode: row.livemode,
        status: row.status,
        attempts: row.attempts,
        receivedAt: row.received_at.toISOString(),
        updatedAt: row.updated_at.toISOString(),
        processedAt: row.processed_at ? row.processed_at.toISOString() : null,
        nextRetryAt: row.next_retry_at ? row.next_retry_at.toISOString() : null,
        processingStartedAt: row.processing_started_at
          ? row.processing_started_at.toISOString()
          : null,
        payloadHash: row.payload_hash ?? null,
        headers: row.headers_json ?? null,
        payloadRaw: row.payload_raw,
        lastError: row.last_error ?? null,
      };
    }),

  retry: publicProcedure
    .input(retryWebhookInboxInputSchema)
    .mutation(async ({ ctx, input }) => {
      assertAdminRole(ctx.session?.user?.role);

      const row = await ctx.prisma.webhookInboxEvent.findUnique({
        where: { id: input.id },
        select: {
          id: true,
          status: true,
        },
      });

      if (!row) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Evento de webhook inbox no encontrado',
        });
      }

      if (!RETRYABLE_STATUSES.includes(row.status as any)) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Solo se pueden reintentar eventos con estado FAILED o IGNORED',
        });
      }

      const updated = await ctx.prisma.webhookInboxEvent.updateMany({
        where: {
          id: row.id,
          status: row.status,
        },
        data: {
          status: 'RECEIVED',
          next_retry_at: null,
          last_error: null,
          processing_started_at: null,
          processed_at: null,
        },
      });

      if (updated.count === 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'El estado del evento cambió antes del reintento',
        });
      }

      const queued = await enqueueWebhookInboxJob({ inboxId: row.id });

      return {
        ok: true,
        queued,
      };
    }),
});
