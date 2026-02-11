import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { shieldedProcedure } from '../procedures/shielded.procedure';
import { log } from '../server';
import { router } from '../trpc';

const checkoutLogsFindManyInputSchema = z
  .object({
    skip: z.number().int().min(0).optional(),
    take: z.number().int().min(1).max(500).optional(),
    orderBy: z.any().optional(),
    where: z.any().optional(),
    select: z.any().optional(),
    include: z.any().optional(),
  })
  .optional();

const checkoutLeadsInputSchema = z
  .object({
    page: z.number().int().min(0).optional(),
    limit: z.number().int().min(10).max(500).optional(),
    status: z.enum(['abandoned', 'recovered', 'all']).optional(),
    search: z.string().max(120).optional(),
    days: z.number().int().min(1).max(365).optional(),
  })
  .optional();

const numberFromUnknown = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

const normalizeDate = (value: Date | string | null): string | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

export const checkoutLogsRouter = router({
  getCheckoutLogs: shieldedProcedure
    .input(checkoutLogsFindManyInputSchema)
    .query(async ({ ctx: { prisma }, input }) => {
      const checkoutLogs = await prisma.checkout_logs.findMany({
        ...(input ?? {}),
        include: {
          users: true,
        },
      });

      return checkoutLogs;
    }),
  getCheckoutLeads: shieldedProcedure
    .input(checkoutLeadsInputSchema)
    .query(async ({ ctx: { prisma }, input }) => {
      const page = input?.page ?? 0;
      const limit = input?.limit ?? 100;
      const status = input?.status ?? 'abandoned';
      const search = input?.search?.trim() ?? '';
      const days = input?.days ?? 30;
      const skip = page * limit;

      const paidOrdersSubquery = Prisma.sql`
        SELECT
          o.user_id AS userId,
          MAX(o.date_order) AS lastPaidDate,
          SUBSTRING_INDEX(
            GROUP_CONCAT(COALESCE(o.payment_method, '') ORDER BY o.date_order DESC SEPARATOR '||'),
            '||',
            1
          ) AS lastPaidMethod,
          CAST(
            SUBSTRING_INDEX(
              GROUP_CONCAT(COALESCE(o.total_price, 0) ORDER BY o.date_order DESC SEPARATOR '||'),
              '||',
              1
            ) AS DECIMAL(12,2)
          ) AS lastPaidAmount
        FROM orders o
        WHERE o.status = 1
          AND o.is_plan = 1
          AND (o.is_canceled IS NULL OR o.is_canceled = 0)
        GROUP BY o.user_id
      `;

      const baseConditions: Prisma.Sql[] = [
        Prisma.sql`1 = 1`,
        Prisma.sql`cl.last_checkout_date >= DATE_SUB(NOW(), INTERVAL ${days} DAY)`,
      ];

      if (search.length > 0) {
        const searchLike = `%${search}%`;
        baseConditions.push(
          Prisma.sql`(
            LOWER(u.email) LIKE LOWER(${searchLike})
            OR LOWER(u.username) LIKE LOWER(${searchLike})
            OR COALESCE(u.phone, '') LIKE ${searchLike}
          )`,
        );
      }

      const statusCondition =
        status === 'abandoned'
          ? Prisma.sql`(lp.lastPaidDate IS NULL OR lp.lastPaidDate < cl.last_checkout_date)`
          : status === 'recovered'
            ? Prisma.sql`(lp.lastPaidDate IS NOT NULL AND lp.lastPaidDate >= cl.last_checkout_date)`
            : Prisma.sql`1 = 1`;

      const whereSql = Prisma.sql`${Prisma.join(
        [...baseConditions, statusCondition],
        ' AND ',
      )}`;
      const baseWhereSql = Prisma.sql`${Prisma.join(
        baseConditions,
        ' AND ',
      )}`;

      const [rows, countRows, summaryRows] = await Promise.all([
        prisma.$queryRaw<
          Array<{
            id: number;
            userId: number;
            username: string;
            email: string;
            phone: string | null;
            userActive: number;
            lastCheckoutDate: Date | string;
            lastPaidDate: Date | string | null;
            lastPaidMethod: string | null;
            lastPaidAmount: number | string | null;
            hoursSinceCheckout: number | bigint;
            paidAfterCheckout: number | bigint;
          }>
        >(Prisma.sql`
          SELECT
            cl.id AS id,
            cl.user_id AS userId,
            u.username AS username,
            u.email AS email,
            u.phone AS phone,
            u.active AS userActive,
            cl.last_checkout_date AS lastCheckoutDate,
            lp.lastPaidDate AS lastPaidDate,
            NULLIF(lp.lastPaidMethod, '') AS lastPaidMethod,
            lp.lastPaidAmount AS lastPaidAmount,
            TIMESTAMPDIFF(HOUR, cl.last_checkout_date, NOW()) AS hoursSinceCheckout,
            CASE
              WHEN lp.lastPaidDate IS NOT NULL AND lp.lastPaidDate >= cl.last_checkout_date THEN 1
              ELSE 0
            END AS paidAfterCheckout
          FROM checkout_logs cl
          INNER JOIN users u
            ON u.id = cl.user_id
          LEFT JOIN (${paidOrdersSubquery}) lp
            ON lp.userId = cl.user_id
          WHERE ${whereSql}
          ORDER BY cl.last_checkout_date DESC
          LIMIT ${limit}
          OFFSET ${skip}
        `),
        prisma.$queryRaw<Array<{ total: number | bigint }>>(Prisma.sql`
          SELECT COUNT(*) AS total
          FROM checkout_logs cl
          INNER JOIN users u
            ON u.id = cl.user_id
          LEFT JOIN (${paidOrdersSubquery}) lp
            ON lp.userId = cl.user_id
          WHERE ${whereSql}
        `),
        prisma.$queryRaw<
          Array<{
            total: number | bigint;
            abandoned: number | bigint;
            recovered: number | bigint;
          }>
        >(Prisma.sql`
          SELECT
            COUNT(*) AS total,
            SUM(CASE
              WHEN lp.lastPaidDate IS NULL OR lp.lastPaidDate < cl.last_checkout_date THEN 1
              ELSE 0
            END) AS abandoned,
            SUM(CASE
              WHEN lp.lastPaidDate IS NOT NULL AND lp.lastPaidDate >= cl.last_checkout_date THEN 1
              ELSE 0
            END) AS recovered
          FROM checkout_logs cl
          INNER JOIN users u
            ON u.id = cl.user_id
          LEFT JOIN (${paidOrdersSubquery}) lp
            ON lp.userId = cl.user_id
          WHERE ${baseWhereSql}
        `),
      ]);

      const total = numberFromUnknown(countRows[0]?.total ?? 0);
      const summary = summaryRows[0] ?? {
        total: 0,
        abandoned: 0,
        recovered: 0,
      };

      return {
        page,
        limit,
        total,
        status,
        range: {
          days,
        },
        summary: {
          totalCandidates: numberFromUnknown(summary.total),
          abandoned: numberFromUnknown(summary.abandoned),
          recovered: numberFromUnknown(summary.recovered),
          showing: rows.length,
        },
        items: rows.map((row) => {
          const paidAfterCheckout = numberFromUnknown(row.paidAfterCheckout) === 1;
          return {
            id: Number(row.id),
            userId: Number(row.userId),
            username: row.username,
            email: row.email,
            phone: row.phone ?? null,
            userActive: numberFromUnknown(row.userActive) === 1,
            lastCheckoutDate: normalizeDate(row.lastCheckoutDate),
            lastPaidDate: normalizeDate(row.lastPaidDate),
            lastPaidMethod: row.lastPaidMethod ?? null,
            lastPaidAmount:
              row.lastPaidAmount == null
                ? null
                : numberFromUnknown(row.lastPaidAmount),
            hoursSinceCheckout: numberFromUnknown(row.hoursSinceCheckout),
            paidAfterCheckout,
            leadStatus: paidAfterCheckout ? 'recovered' : 'abandoned',
          };
        }),
      };
    }),
  registerCheckoutLog: shieldedProcedure.mutation(
    async ({ ctx: { prisma, session } }) => {
      const user = session!.user!;

      const lastCheckout = await prisma.checkout_logs.findFirst({
        where: {
          user_id: user.id,
        },
      });

      if (lastCheckout) {
        await prisma.checkout_logs.update({
          where: {
            id: lastCheckout.id,
          },
          data: {
            last_checkout_date: new Date(),
          },
        });
      } else {
        log.info(
          `[CHECKOUT_LOGS] Creating new checkout log for user ${user.id}`,
        );
        await prisma.checkout_logs.create({
          data: {
            user_id: user.id,
            last_checkout_date: new Date(),
          },
        });
      }

      return {
        message: 'Log de checkout registrado exitosamente',
      };
    },
  ),
});
