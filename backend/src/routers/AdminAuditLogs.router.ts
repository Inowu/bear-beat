import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { shieldedProcedure } from '../procedures/shielded.procedure';
import { router } from '../trpc';

const adminAuditLogsInputSchema = z
  .object({
    page: z.number().int().min(0).optional(),
    limit: z.number().int().min(1).max(200).optional(),
    action: z.string().trim().max(80).optional(),
    targetUserId: z.number().int().positive().optional(),
    dateFrom: z.string().trim().max(40).optional(),
    dateTo: z.string().trim().max(40).optional(),
  })
  .optional();

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
      message: 'Fecha inválida para filtrar auditoría',
    });
  }

  if (isDayOnly && boundary === 'end') {
    base.setUTCHours(23, 59, 59, 999);
  }

  return base;
};

export const adminAuditLogsRouter = router({
  getAdminAuditLogs: shieldedProcedure
    .input(adminAuditLogsInputSchema)
    .query(async ({ ctx: { prisma }, input }) => {
      const page = input?.page ?? 0;
      const limit = input?.limit ?? 100;
      const action = input?.action?.trim();
      const targetUserId = input?.targetUserId;
      const dateFrom = parseDateInput(input?.dateFrom, 'start');
      const dateTo = parseDateInput(input?.dateTo, 'end');

      if (dateFrom && dateTo && dateFrom > dateTo) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'El rango de fechas es inválido',
        });
      }

      const where: {
        action?: string;
        target_user_id?: number;
        created_at?: {
          gte?: Date;
          lte?: Date;
        };
      } = {};

      if (action) {
        where.action = action;
      }
      if (typeof targetUserId === 'number') {
        where.target_user_id = targetUserId;
      }
      if (dateFrom || dateTo) {
        where.created_at = {
          ...(dateFrom ? { gte: dateFrom } : {}),
          ...(dateTo ? { lte: dateTo } : {}),
        };
      }

      const [total, rows] = await Promise.all([
        prisma.adminAuditLog.count({ where }),
        prisma.adminAuditLog.findMany({
          where,
          skip: page * limit,
          take: limit,
          orderBy: {
            created_at: 'desc',
          },
        }),
      ]);

      return {
        page,
        limit,
        total,
        items: rows.map((row) => ({
          id: row.id,
          createdAt: row.created_at.toISOString(),
          actorUserId: row.actor_user_id,
          action: row.action,
          targetUserId: row.target_user_id,
          metadata: row.metadata_json ?? null,
          ip: row.ip ?? null,
          userAgent: row.user_agent ?? null,
        })),
      };
    }),
});
