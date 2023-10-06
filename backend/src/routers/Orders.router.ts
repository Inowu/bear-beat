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
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { OrderStatus } from './subscriptions/interfaces/order-status.interface';
import { SubscriptionService } from './subscriptions/services/types';

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
                payment_method: SubscriptionService.PAYPAL,
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

        return await prisma.orders.create({
          data: {
            user_id: user.id,
            plan_id: plan.id,
            txn_id: subscriptionId,
            status: OrderStatus.PENDING,
            is_plan: 1,
            date_order: new Date().toISOString(),
            total_price: Number(plan.price),
            payment_method: SubscriptionService.PAYPAL,
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
    .mutation(async ({ ctx: { prisma }, input: { id } }) => {
      return await prisma.orders.update({
        where: {
          id,
        },
        data: {
          status: OrderStatus.CANCELLED,
          is_canceled: 1,
        },
      });
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
      const findFirstOrdersOrThrow = await ctx.prisma.orders.findFirstOrThrow(
        input,
      );
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
      const findUniqueOrdersOrThrow = await ctx.prisma.orders.findUniqueOrThrow(
        input,
      );
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
