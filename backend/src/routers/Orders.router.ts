import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { Prisma } from '@prisma/client';
import { router } from '../trpc';
import { shieldedProcedure } from '../procedures/shielded.procedure';
import { OrdersAggregateSchema } from '../schemas/aggregateOrders.schema';
import { OrdersCreateManySchema } from '../schemas/createManyOrders.schema';
import { OrdersCreateOneSchema } from '../schemas/createOneOrders.schema';
import { OrdersDeleteManySchema } from '../schemas/deleteManyOrders.schema';
import { OrdersDeleteOneSchema } from '../schemas/deleteOneOrders.schema';
import { OrdersFindFirstSchema } from '../schemas/findFirstOrders.schema';
import { OrdersFindManySchema } from '../schemas/findManyOrders.schema';
import { OrdersFindUniqueSchema } from '../schemas/findUniqueOrders.schema';
import { OrdersGroupBySchema } from '../schemas/groupByOrders.schema';
import { OrdersUpdateManySchema } from '../schemas/updateManyOrders.schema';
import { OrdersUpdateOneSchema } from '../schemas/updateOneOrders.schema';
import { OrdersUpsertSchema } from '../schemas/upsertOneOrders.schema';
import { OrderStatus } from './subscriptions/interfaces/order-status.interface';
import { PaymentService } from './subscriptions/services/types';
import { RolesNames } from './auth/interfaces/roles.interface';
import { createAdminAuditLog } from './utils/adminAuditLog';
import { computeAnalyticsCurrencyTotals } from '../utils/analyticsCurrency';

interface AdminOrders {
  city: string;
  date_order: Date;
  email: string;
  id: number;
  payment_method: "Paypal" | "Stripe" | null;
  phone: string;
  status: number;
  total_price: number;
  txn_id: string;
}

const ordersDedupJoinSql = Prisma.sql`
  INNER JOIN (
    SELECT MAX(od.id) AS id
    FROM orders od
    GROUP BY CASE
      WHEN LOWER(COALESCE(TRIM(od.payment_method), '')) IN ('stripe', 'paypal')
        AND COALESCE(TRIM(od.txn_id), '') <> ''
      THEN CONCAT(
        'provider:', LOWER(COALESCE(TRIM(od.payment_method), '')),
        '|txn:', LOWER(COALESCE(TRIM(od.txn_id), '')),
        '|user:', od.user_id,
        '|status:', od.status,
        '|amount:', ROUND(od.total_price, 2),
        '|day:', DATE(od.date_order)
      )
      ELSE CONCAT('order-id:', od.id)
    END
  ) dedup_orders ON dedup_orders.id = o.id
`;

export const ordersRouter = router({
  ownOrders: shieldedProcedure
    .input(OrdersFindManySchema)
    .query(async ({ ctx: { prisma, session }, input }) => {
      const orders = await prisma.orders.findMany({
        ...input,
        where: {
          ...input.where,
          user_id: session!.user!.id,
        },
      });

      return orders;
    }),
  findManyOrdersWithUsers: shieldedProcedure
    .input(
      z.object({
        email: z.string().optional(),
        phone: z.string().optional(),
        status: z.nativeEnum(OrderStatus).optional(),
        paymentMethod: z.string().optional(),
        date_order: z
          .union([
            z.object({
              gte: z.string().optional(),
              lte: z.string().optional(),
            }),
            z.string(),
          ])
          .optional(),
        take: z.number().default(10),
        skip: z.number().default(0),
      }),
    )
    .query(
      async ({
        ctx: { prisma },
        input: {
          email,
          phone,
          status,
          date_order,
          paymentMethod,
          take,
          skip,
        },
      }) => {
        const whereClauses: Prisma.Sql[] = [];

        if (email) {
          const likeValue = `%${email}%`;
          const orderIdFromSearch = Number(email);
          if (Number.isInteger(orderIdFromSearch)) {
            whereClauses.push(
              Prisma.sql`(u.email LIKE ${likeValue} OR u.phone LIKE ${likeValue} OR o.id = ${orderIdFromSearch})`,
            );
          } else {
            whereClauses.push(
              Prisma.sql`(u.email LIKE ${likeValue} OR u.phone LIKE ${likeValue})`,
            );
          }
        }

        if (phone) {
          whereClauses.push(Prisma.sql`u.phone LIKE ${`%${phone}%`}`);
        }

        if (typeof status === 'number') {
          whereClauses.push(Prisma.sql`o.status = ${status}`);
        }

        if (paymentMethod) {
          whereClauses.push(
            Prisma.sql`o.payment_method LIKE ${`%${paymentMethod}%`}`,
          );
        }

        if (date_order) {
          if (typeof date_order === 'string') {
            whereClauses.push(
              Prisma.sql`o.date_order LIKE ${`%${date_order}%`}`,
            );
          } else if (typeof date_order === 'object') {
            if (date_order.gte && date_order.lte) {
              whereClauses.push(
                Prisma.sql`o.date_order BETWEEN ${date_order.gte} AND ${date_order.lte}`,
              );
            } else if (date_order.gte) {
              whereClauses.push(Prisma.sql`o.date_order >= ${date_order.gte}`);
            } else if (date_order.lte) {
              whereClauses.push(Prisma.sql`o.date_order <= ${date_order.lte}`);
            }
          }
        }

        const whereSql =
          whereClauses.length > 0
            ? Prisma.sql`WHERE ${Prisma.join(whereClauses, ' AND ')}`
            : Prisma.empty;

        const countQuery = Prisma.sql`SELECT COUNT(*) as totalCount
          FROM orders o
          ${ordersDedupJoinSql}
          INNER JOIN users u ON o.user_id = u.id
          ${whereSql}`;

        // Set pagination or not based on offset and limit being defined.
        // Take will always be truthy if we're trying to fill the table.
        // Take will be falsey if we're trying to export orders in a CSV.
        const paginationSql = take
          ? Prisma.sql`LIMIT ${take} OFFSET ${skip}`
          : Prisma.empty;

        const query = Prisma.sql`SELECT o.id, o.date_order, o.status, o.total_price, o.txn_id, o.payment_method, u.city, u.email, u.phone
          FROM orders o
          ${ordersDedupJoinSql}
          INNER JOIN users u ON o.user_id = u.id
          ${whereSql}
          ORDER BY o.date_order DESC
          ${paginationSql};`;

        const count = await prisma.$queryRaw<Array<{ totalCount: bigint | number }>>(countQuery);
        const results = await prisma.$queryRaw<AdminOrders[]>(query);

        return {
          count: Number(count[0]?.totalCount ?? 0),
          data: results,
        };
      },
    ),
  getOrdersFinancialSummary: shieldedProcedure
    .input(
      z
        .object({
          email: z.string().optional(),
          phone: z.string().optional(),
          status: z.nativeEnum(OrderStatus).optional(),
          paymentMethod: z.string().optional(),
          date_order: z
            .union([
              z.object({
                gte: z.string().optional(),
                lte: z.string().optional(),
              }),
              z.string(),
            ])
            .optional(),
        })
        .optional(),
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const whereClauses: Prisma.Sql[] = [];

      const email = input?.email;
      const phone = input?.phone;
      const status = input?.status;
      const paymentMethod = input?.paymentMethod;
      const date_order = input?.date_order;

      if (email) {
        const likeValue = `%${email}%`;
        const orderIdFromSearch = Number(email);
        if (Number.isInteger(orderIdFromSearch)) {
          whereClauses.push(
            Prisma.sql`(u.email LIKE ${likeValue} OR u.phone LIKE ${likeValue} OR o.id = ${orderIdFromSearch})`,
          );
        } else {
          whereClauses.push(
            Prisma.sql`(u.email LIKE ${likeValue} OR u.phone LIKE ${likeValue})`,
          );
        }
      }

      if (phone) {
        whereClauses.push(Prisma.sql`u.phone LIKE ${`%${phone}%`}`);
      }

      if (typeof status === 'number') {
        whereClauses.push(Prisma.sql`o.status = ${status}`);
      }

      if (paymentMethod) {
        whereClauses.push(
          Prisma.sql`o.payment_method LIKE ${`%${paymentMethod}%`}`,
        );
      }

      let hasExplicitDateFilter = false;
      if (date_order) {
        hasExplicitDateFilter = true;
        if (typeof date_order === 'string') {
          whereClauses.push(
            Prisma.sql`o.date_order LIKE ${`%${date_order}%`}`,
          );
        } else if (typeof date_order === 'object') {
          if (date_order.gte && date_order.lte) {
            whereClauses.push(
              Prisma.sql`o.date_order BETWEEN ${date_order.gte} AND ${date_order.lte}`,
            );
          } else if (date_order.gte) {
            whereClauses.push(Prisma.sql`o.date_order >= ${date_order.gte}`);
          } else if (date_order.lte) {
            whereClauses.push(Prisma.sql`o.date_order <= ${date_order.lte}`);
          }
        }
      }

      const whereSql =
        whereClauses.length > 0
          ? Prisma.sql`WHERE ${Prisma.join(whereClauses, ' AND ')}`
          : Prisma.empty;

      const numberFromUnknown = (value: unknown): number => {
        if (typeof value === 'bigint') return Number(value);
        if (typeof value === 'number' && Number.isFinite(value)) return value;
        if (typeof value === 'string') {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
      };

      const totalsRows = await prisma.$queryRaw<
        Array<{
          totalOrders: bigint | number;
          grossRevenue: bigint | number;
          grossRevenueMxn: bigint | number;
          grossRevenueUsd: bigint | number;
          grossRevenueOther: bigint | number;
        }>
      >(Prisma.sql`
        SELECT
          COUNT(*) AS totalOrders,
          COALESCE(SUM(o.total_price), 0) AS grossRevenue,
          COALESCE(SUM(CASE
            WHEN LOWER(COALESCE(NULLIF(TRIM(p.moneda), ''), 'unknown')) = 'mxn'
              THEN o.total_price
            ELSE 0
          END), 0) AS grossRevenueMxn,
          COALESCE(SUM(CASE
            WHEN LOWER(COALESCE(NULLIF(TRIM(p.moneda), ''), 'unknown')) = 'usd'
              THEN o.total_price
            ELSE 0
          END), 0) AS grossRevenueUsd,
          COALESCE(SUM(CASE
            WHEN LOWER(COALESCE(NULLIF(TRIM(p.moneda), ''), 'unknown')) NOT IN ('mxn', 'usd')
              THEN o.total_price
            ELSE 0
          END), 0) AS grossRevenueOther
        FROM orders o
        ${ordersDedupJoinSql}
        INNER JOIN users u ON o.user_id = u.id
        LEFT JOIN plans p ON p.id = o.plan_id
        ${whereSql}
      `);

      const breakdownRows = await prisma.$queryRaw<
        Array<{
          paymentMethod: string | null;
          totalOrders: bigint | number;
          grossRevenue: bigint | number;
          grossRevenueMxn: bigint | number;
          grossRevenueUsd: bigint | number;
          grossRevenueOther: bigint | number;
        }>
      >(Prisma.sql`
        SELECT
          COALESCE(NULLIF(TRIM(o.payment_method), ''), 'Unknown') AS paymentMethod,
          COUNT(*) AS totalOrders,
          COALESCE(SUM(o.total_price), 0) AS grossRevenue,
          COALESCE(SUM(CASE
            WHEN LOWER(COALESCE(NULLIF(TRIM(p.moneda), ''), 'unknown')) = 'mxn'
              THEN o.total_price
            ELSE 0
          END), 0) AS grossRevenueMxn,
          COALESCE(SUM(CASE
            WHEN LOWER(COALESCE(NULLIF(TRIM(p.moneda), ''), 'unknown')) = 'usd'
              THEN o.total_price
            ELSE 0
          END), 0) AS grossRevenueUsd,
          COALESCE(SUM(CASE
            WHEN LOWER(COALESCE(NULLIF(TRIM(p.moneda), ''), 'unknown')) NOT IN ('mxn', 'usd')
              THEN o.total_price
            ELSE 0
          END), 0) AS grossRevenueOther
        FROM orders o
        ${ordersDedupJoinSql}
        INNER JOIN users u ON o.user_id = u.id
        LEFT JOIN plans p ON p.id = o.plan_id
        ${whereSql}
        GROUP BY paymentMethod
        ORDER BY grossRevenue DESC
      `);

      const trendWhereClauses = [...whereClauses];
      const now = new Date();
      const fallbackTrendStart = new Date(
        now.getTime() - 90 * 24 * 60 * 60 * 1000,
      );
      if (!hasExplicitDateFilter) {
        trendWhereClauses.push(
          Prisma.sql`o.date_order BETWEEN ${fallbackTrendStart} AND ${now}`,
        );
      }
      const trendWhereSql =
        trendWhereClauses.length > 0
          ? Prisma.sql`WHERE ${Prisma.join(trendWhereClauses, ' AND ')}`
          : Prisma.empty;

      const trendRows = await prisma.$queryRaw<
        Array<{
          day: string;
          totalOrders: bigint | number;
          grossRevenue: bigint | number;
          grossRevenueMxn: bigint | number;
          grossRevenueUsd: bigint | number;
          grossRevenueOther: bigint | number;
        }>
      >(Prisma.sql`
        SELECT
          DATE(o.date_order) AS day,
          COUNT(*) AS totalOrders,
          COALESCE(SUM(o.total_price), 0) AS grossRevenue,
          COALESCE(SUM(CASE
            WHEN LOWER(COALESCE(NULLIF(TRIM(p.moneda), ''), 'unknown')) = 'mxn'
              THEN o.total_price
            ELSE 0
          END), 0) AS grossRevenueMxn,
          COALESCE(SUM(CASE
            WHEN LOWER(COALESCE(NULLIF(TRIM(p.moneda), ''), 'unknown')) = 'usd'
              THEN o.total_price
            ELSE 0
          END), 0) AS grossRevenueUsd,
          COALESCE(SUM(CASE
            WHEN LOWER(COALESCE(NULLIF(TRIM(p.moneda), ''), 'unknown')) NOT IN ('mxn', 'usd')
              THEN o.total_price
            ELSE 0
          END), 0) AS grossRevenueOther
        FROM orders o
        ${ordersDedupJoinSql}
        INNER JOIN users u ON o.user_id = u.id
        LEFT JOIN plans p ON p.id = o.plan_id
        ${trendWhereSql}
        GROUP BY day
        ORDER BY day ASC
      `);

      const totals = totalsRows?.[0] ?? {
        totalOrders: 0,
        grossRevenue: 0,
        grossRevenueMxn: 0,
        grossRevenueUsd: 0,
        grossRevenueOther: 0,
      };
      const totalOrders = numberFromUnknown(totals.totalOrders);
      const grossRevenue = numberFromUnknown(totals.grossRevenue);
      const grossRevenueByCurrency = computeAnalyticsCurrencyTotals({
        mxn: totals.grossRevenueMxn,
        usd: totals.grossRevenueUsd,
        other: totals.grossRevenueOther,
      });
      const grossRevenueConvertedMxn =
        grossRevenueByCurrency.convertedMxn;
      const avgOrderValue = totalOrders > 0 ? grossRevenue / totalOrders : 0;
      const avgOrderValueConvertedMxn =
        grossRevenueConvertedMxn != null && totalOrders > 0
          ? grossRevenueConvertedMxn / totalOrders
          : null;

      return {
        totals: {
          totalOrders,
          grossRevenue,
          grossRevenueByCurrency,
          grossRevenueConvertedMxn,
          avgOrderValue,
          avgOrderValueConvertedMxn,
        },
        byPaymentMethod: breakdownRows.map((row) => {
          const byCurrency = computeAnalyticsCurrencyTotals({
            mxn: row.grossRevenueMxn,
            usd: row.grossRevenueUsd,
            other: row.grossRevenueOther,
          });
          return {
            paymentMethod: row.paymentMethod ?? 'Unknown',
            totalOrders: numberFromUnknown(row.totalOrders),
            grossRevenue: numberFromUnknown(row.grossRevenue),
            grossRevenueByCurrency: byCurrency,
            grossRevenueConvertedMxn: byCurrency.convertedMxn,
          };
        }),
        trend: {
          days: hasExplicitDateFilter ? null : 90,
          points: trendRows.map((row) => {
            const byCurrency = computeAnalyticsCurrencyTotals({
              mxn: row.grossRevenueMxn,
              usd: row.grossRevenueUsd,
              other: row.grossRevenueOther,
            });
            return {
              day: row.day,
              totalOrders: numberFromUnknown(row.totalOrders),
              grossRevenue: numberFromUnknown(row.grossRevenue),
              grossRevenueByCurrency: byCurrency,
              grossRevenueConvertedMxn: byCurrency.convertedMxn,
            };
          }),
        },
      };
    }),
  createPaypalOrder: shieldedProcedure
    .input(
      z.object({
        planId: z.number(),
        subscriptionId: z.string(),
      }),
    )
    .mutation(
      async ({
        ctx: { prisma, session },
        input: { planId, subscriptionId },
      }) => {
        const user = session!.user!;
        const plan = await prisma.plans.findFirst({
          where: {
            id: planId,
          },
        });

        if (!plan) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Ese plan no existe',
          });
        }

        const activeSubscription = await prisma.descargasUser.findFirst({
          where: {
            AND: [
              {
                user_id: user.id,
              },
              {
                date_end: {
                  gte: new Date(),
                },
              },
            ],
          },
        });

        if (activeSubscription) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Ya tienes una suscripción activa',
          });
        }

        const pendingOrder = await prisma.orders.findFirst({
          where: {
            AND: [
              {
                user_id: user.id,
              },
              {
                status: OrderStatus.PENDING,
              },
              {
                payment_method: PaymentService.PAYPAL,
              },
            ],
          },
        });

        if (pendingOrder) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Ya existe una orden pendiente de pago con paypal',
          });
        }

        return prisma.orders.create({
          data: {
            user_id: user.id,
            plan_id: plan.id,
            txn_id: subscriptionId,
            status: OrderStatus.PENDING,
            is_plan: 1,
            date_order: new Date(),
            total_price: Number(plan.price),
            payment_method: PaymentService.PAYPAL,
          },
        });
      },
    ),
  cancelOrder: shieldedProcedure
    .input(
      z.object({
        id: z.number().int().positive(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const sessionUser = ctx.session?.user;
      if (!sessionUser) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Sesión requerida',
        });
      }

      const existingOrder = await ctx.prisma.orders.findUnique({
        where: { id: input.id },
        select: { id: true, user_id: true, status: true },
      });

      if (!existingOrder) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Orden no encontrada',
        });
      }

      const isAdmin = sessionUser.role === RolesNames.admin;
      if (!isAdmin && existingOrder.user_id !== sessionUser.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'No autorizado',
        });
      }

      const updatedOrder = await ctx.prisma.orders.update({
        where: { id: existingOrder.id },
        data: {
          status: OrderStatus.CANCELLED,
          is_canceled: 1,
        },
      });

      if (isAdmin) {
        await createAdminAuditLog({
          prisma: ctx.prisma,
          actorUserId: sessionUser.id,
          action: 'cancel_order',
          req: ctx.req,
          targetUserId: existingOrder.user_id,
          metadata: {
            orderId: existingOrder.id,
            previousStatus: existingOrder.status,
            nextStatus: OrderStatus.CANCELLED,
          },
        });
      }

      return updatedOrder;
    }),
  aggregateOrders: shieldedProcedure
    .input(OrdersAggregateSchema)
    .query(async ({ ctx, input }) => {
      const aggregateOrders = await ctx.prisma.orders.aggregate(input);
      return aggregateOrders;
    }),
  createManyOrders: shieldedProcedure
    .input(OrdersCreateManySchema)
    .mutation(async ({ ctx, input }) => {
      const createManyOrders = await ctx.prisma.orders.createMany(input);
      return createManyOrders;
    }),
  createOneOrders: shieldedProcedure
    .input(OrdersCreateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const created = await ctx.prisma.orders.create(input);

      if (ctx.session?.user?.role === RolesNames.admin) {
        await createAdminAuditLog({
          prisma: ctx.prisma,
          actorUserId: ctx.session.user.id,
          action: 'create_order',
          req: ctx.req,
          targetUserId: created.user_id,
          metadata: {
            orderId: created.id,
            userId: created.user_id,
            planId: created.plan_id ?? null,
            status: created.status,
            paymentMethod: created.payment_method ?? null,
            totalPrice: created.total_price,
          },
        });
      }

      return created;
    }),
  deleteManyOrders: shieldedProcedure
    .input(OrdersDeleteManySchema)
    .mutation(async ({ ctx, input }) => {
      const deleteManyOrders = await ctx.prisma.orders.deleteMany(input);
      return deleteManyOrders;
    }),
  deleteOneOrders: shieldedProcedure
    .input(OrdersDeleteOneSchema)
    .mutation(async ({ ctx, input }) => {
      const orderId =
        typeof (input as any)?.where?.id === 'number' ? (input as any).where.id : null;
      const existing =
        orderId != null
          ? await ctx.prisma.orders.findUnique({
              where: { id: orderId },
              select: { id: true, user_id: true, status: true, total_price: true, payment_method: true, plan_id: true },
            })
          : null;

      const deleted = await ctx.prisma.orders.delete(input);

      if (ctx.session?.user?.role === RolesNames.admin) {
        await createAdminAuditLog({
          prisma: ctx.prisma,
          actorUserId: ctx.session.user.id,
          action: 'delete_order',
          req: ctx.req,
          targetUserId: existing?.user_id ?? deleted.user_id,
          metadata: {
            orderId: deleted.id,
            userId: deleted.user_id,
            planId: deleted.plan_id ?? null,
            status: deleted.status,
            paymentMethod: deleted.payment_method ?? null,
            totalPrice: deleted.total_price,
          },
        });
      }

      return deleted;
    }),
  findFirstOrders: shieldedProcedure
    .input(OrdersFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstOrders = await ctx.prisma.orders.findFirst(input);
      return findFirstOrders;
    }),
  findFirstOrdersOrThrow: shieldedProcedure
    .input(OrdersFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstOrdersOrThrow =
        await ctx.prisma.orders.findFirstOrThrow(input);
      return findFirstOrdersOrThrow;
    }),
  findManyOrders: shieldedProcedure
    .input(OrdersFindManySchema)
    .query(async ({ ctx, input }) => {
      const findManyOrders = await ctx.prisma.orders.findMany(input);
      return findManyOrders;
    }),
  findUniqueOrders: shieldedProcedure
    .input(OrdersFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueOrders = await ctx.prisma.orders.findUnique(input);
      return findUniqueOrders;
    }),
  findUniqueOrdersOrThrow: shieldedProcedure
    .input(OrdersFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueOrdersOrThrow =
        await ctx.prisma.orders.findUniqueOrThrow(input);
      return findUniqueOrdersOrThrow;
    }),
  groupByOrders: shieldedProcedure
    .input(OrdersGroupBySchema)
    .query(async ({ ctx, input }) => {
      const groupByOrders = await ctx.prisma.orders.groupBy({
        where: input.where,
        orderBy: input.orderBy,
        by: input.by,
        having: input.having,
        take: input.take,
        skip: input.skip,
      });
      return groupByOrders;
    }),
  updateManyOrders: shieldedProcedure
    .input(OrdersUpdateManySchema)
    .mutation(async ({ ctx, input }) => {
      const updateManyOrders = await ctx.prisma.orders.updateMany(input);
      return updateManyOrders;
    }),
  updateOneOrders: shieldedProcedure
    .input(OrdersUpdateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const orderId =
        typeof (input as any)?.where?.id === 'number' ? (input as any).where.id : null;
      const existing =
        orderId != null
          ? await ctx.prisma.orders.findUnique({
              where: { id: orderId },
              select: { id: true, user_id: true, status: true, total_price: true, payment_method: true, plan_id: true },
            })
          : null;

      const updated = await ctx.prisma.orders.update(input);

      if (ctx.session?.user?.role === RolesNames.admin) {
        await createAdminAuditLog({
          prisma: ctx.prisma,
          actorUserId: ctx.session.user.id,
          action: 'update_order',
          req: ctx.req,
          targetUserId: existing?.user_id ?? updated.user_id,
          metadata: {
            orderId: updated.id,
            userId: updated.user_id,
            planId: updated.plan_id ?? null,
            paymentMethod: updated.payment_method ?? null,
            statusFrom: existing?.status ?? null,
            statusTo: updated.status,
            totalPriceFrom: existing?.total_price ?? null,
            totalPriceTo: updated.total_price,
          },
        });
      }

      return updated;
    }),
  upsertOneOrders: shieldedProcedure
    .input(OrdersUpsertSchema)
    .mutation(async ({ ctx, input }) => {
      const upsertOneOrders = await ctx.prisma.orders.upsert(input);
      return upsertOneOrders;
    }),
});
