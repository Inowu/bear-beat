import { z } from 'zod';
import { TRPCError } from '@trpc/server';
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
import { UsersFindManySchema } from '../schemas';
import { Prisma } from '@prisma/client';

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
        orderBy: z
          .object({
            field: z.string(),
            direction: z
              .union([z.literal('asc'), z.literal('desc')])
              .default('desc'),
          })
          .default({
            field: 'o.id',
            direction: 'desc',
          }),
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
          orderBy,
        },
      }) => {
        const filters = [
          { email },
          { phone },
          { status },
          { date_order },
          { paymentMethod },
        ]
          .filter((filter) => !!Object.values(filter)[0])
          .map((filter) => {
            const [key, value] = Object.entries(filter)[0];

            if (typeof value === 'object' && 'gte' in value && 'lte' in value) {
              return Prisma.sql`
                date_order BETWEEN ${value.gte} AND ${value.lte}
              `;
            }

            return `${key} LIKE '%${value}%'`;
          })
          .join(' AND ');

        const countQuery = Prisma.sql`
          SELECT COUNT(*) FROM orders o INNER JOIN users u ON o.user_id = u.id WHERE ?
        `;

        const query = Prisma.sql`
          SELECT * FROM orders o INNER JOIN users u ON o.user_id = u.id WHERE ?
        `;

        console.log(filters);

        const count = await prisma.$queryRaw(
          `SELECT COUNT(*) FROM orders o INNER JOIN users u ON o.user_id = u.id WHERE ${filters}`,
        );

        // (
        //   countQuery,
        //   "email = 'gmail'",
        // ...[filters, `${orderBy.field} ${orderBy.direction}`, take, skip],
        // );

        const results =
          await prisma.$queryRaw`SELECT * FROM orders o INNER JOIN users u ON o.user_id = u.id WHERE ${filters}`;

        // const results = await prisma.$queryRaw(
        //   query,
        //   ...[filters, `${orderBy.field} ${orderBy.direction}`, take, skip],
        // );

        console.log({ count, results });

        return {
          count,
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
                  gte: new Date().toISOString(),
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
            date_order: new Date().toISOString(),
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
