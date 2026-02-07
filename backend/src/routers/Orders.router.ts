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
        id: z.number(),
      }),
    )
    .mutation(async ({ ctx: { prisma }, input: { id } }) =>
      prisma.orders.update({
        where: {
          id,
        },
        data: {
          status: OrderStatus.CANCELLED,
          is_canceled: 1,
        },
      }),
    ),
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
      const createOneOrders = await ctx.prisma.orders.create(input);
      return createOneOrders;
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
      const deleteOneOrders = await ctx.prisma.orders.delete(input);
      return deleteOneOrders;
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
      const updateOneOrders = await ctx.prisma.orders.update(input);
      return updateOneOrders;
    }),
  upsertOneOrders: shieldedProcedure
    .input(OrdersUpsertSchema)
    .mutation(async ({ ctx, input }) => {
      const upsertOneOrders = await ctx.prisma.orders.upsert(input);
      return upsertOneOrders;
    }),
});
