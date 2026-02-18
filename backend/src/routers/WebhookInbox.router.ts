import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { enqueueWebhookInboxJob } from '../queue/webhookInbox';
import { shieldedProcedure } from '../procedures/shielded.procedure';
import { router } from '../trpc';
import { markWebhookInboxEventEnqueued } from '../webhookInbox/service';

const webhookInboxListInputSchema = z
  .object({
    page: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(200).optional(),
    provider: z.string().trim().max(32).optional(),
    status: z.string().trim().max(20).optional(),
    eventType: z.string().trim().max(120).optional(),
    eventId: z.string().trim().max(191).optional(),
    dateFrom: z.string().trim().max(40).optional(),
    dateTo: z.string().trim().max(40).optional(),
  })
  .optional();

const webhookInboxGetInputSchema = z.object({
  id: z.number().int().positive(),
});

const webhookInboxRetryInputSchema = z.object({
  id: z.number().int().positive(),
});

const parseDateInput = (
  value: string | undefined,
  boundary: 'start' | 'end',
): Date | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const isDayOnly = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  const base = isDayOnly
    ? new Date(`${trimmed}T00:00:00.000Z`)
    : new Date(trimmed);
  if (Number.isNaN(base.getTime())) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'Fecha inválida para filtrar webhook inbox',
    });
  }

  if (isDayOnly && boundary === 'end') {
    base.setUTCHours(23, 59, 59, 999);
  }

  return base;
};

const normalizeErrorText = (value: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > 500 ? `${trimmed.slice(0, 500)}...` : trimmed;
};

export const webhookInboxRouter = router({
  listWebhookInboxEvents: shieldedProcedure
    .input(webhookInboxListInputSchema)
    .query(async ({ ctx: { prisma }, input }) => {
      const page = input?.page ?? 0;
      const limit = input?.limit ?? 100;
      const provider = input?.provider?.trim();
      const status = input?.status?.trim();
      const eventType = input?.eventType?.trim();
      const eventId = input?.eventId?.trim();
      const dateFrom = parseDateInput(input?.dateFrom, 'start');
      const dateTo = parseDateInput(input?.dateTo, 'end');

      if (dateFrom && dateTo && dateFrom > dateTo) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'El rango de fechas es inválido',
        });
      }

      const where: {
        provider?: string;
        status?: string;
        event_type?: string;
        event_id?: string;
        received_at?: {
          gte?: Date;
          lte?: Date;
        };
      } = {};

      if (provider) where.provider = provider;
      if (status) where.status = status;
      if (eventType) where.event_type = eventType;
      if (eventId) where.event_id = eventId;
      if (dateFrom || dateTo) {
        where.received_at = {
          ...(dateFrom ? { gte: dateFrom } : {}),
          ...(dateTo ? { lte: dateTo } : {}),
        };
      }

      const [total, rows] = await Promise.all([
        prisma.webhookInboxEvent.count({ where }),
        prisma.webhookInboxEvent.findMany({
          where,
          skip: page * limit,
          take: limit,
          orderBy: { received_at: 'desc' },
          select: {
            id: true,
            provider: true,
            event_id: true,
            event_type: true,
            livemode: true,
            status: true,
            attempts: true,
            received_at: true,
            processed_at: true,
            next_retry_at: true,
            last_error: true,
          },
        }),
      ]);

      return {
        page,
        limit,
        total,
        items: rows.map((row) => ({
          id: row.id,
          provider: row.provider,
          eventId: row.event_id,
          eventType: row.event_type,
          livemode: row.livemode,
          status: row.status,
          attempts: row.attempts,
          receivedAt: row.received_at.toISOString(),
          processedAt: row.processed_at ? row.processed_at.toISOString() : null,
          nextRetryAt: row.next_retry_at ? row.next_retry_at.toISOString() : null,
          lastError: normalizeErrorText(row.last_error),
        })),
      };
    }),

  getWebhookInboxEvent: shieldedProcedure
    .input(webhookInboxGetInputSchema)
    .query(async ({ ctx: { prisma }, input }) => {
      const row = await prisma.webhookInboxEvent.findUnique({
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

  retryWebhookInboxEvent: shieldedProcedure
    .input(webhookInboxRetryInputSchema)
    .mutation(async ({ ctx: { prisma }, input }) => {
      const row = await prisma.webhookInboxEvent.findUnique({
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

      if (row.status === 'PROCESSING') {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'El evento ya se está procesando',
        });
      }

      await prisma.webhookInboxEvent.update({
        where: { id: row.id },
        data: {
          status: 'FAILED',
          next_retry_at: new Date(),
          processing_started_at: null,
          processed_at: null,
          last_error: null,
        },
      });

      const queued = await enqueueWebhookInboxJob({ inboxId: row.id });
      if (queued) {
        await markWebhookInboxEventEnqueued(row.id);
      }

      return {
        ok: queued,
        queued,
        message: queued
          ? 'Evento reencolado'
          : 'No se pudo encolar el evento; el sweeper lo retomará',
      };
    }),
});
