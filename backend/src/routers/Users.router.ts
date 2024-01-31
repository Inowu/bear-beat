import { shieldedProcedure } from '../procedures/shielded.procedure';
import { router } from '../trpc';
import { UsersAggregateSchema } from '../schemas/aggregateUsers.schema';
import { UsersCreateManySchema } from '../schemas/createManyUsers.schema';
import { UsersCreateOneSchema } from '../schemas/createOneUsers.schema';
import { UsersDeleteManySchema } from '../schemas/deleteManyUsers.schema';
import { UsersDeleteOneSchema } from '../schemas/deleteOneUsers.schema';
import { UsersFindFirstSchema } from '../schemas/findFirstUsers.schema';
import { UsersFindManySchema } from '../schemas/findManyUsers.schema';
import { UsersFindUniqueSchema } from '../schemas/findUniqueUsers.schema';
import { UsersGroupBySchema } from '../schemas/groupByUsers.schema';
import { UsersUpdateManySchema } from '../schemas/updateManyUsers.schema';
import { UsersUpdateOneSchema } from '../schemas/updateOneUsers.schema';
import { UsersUpsertSchema } from '../schemas/upsertOneUsers.schema';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { log } from '../server';
import { cancelServicesSubscriptions } from './subscriptions/cancel/cancelServicesSubscriptions';

export const usersRouter = router({
  getActiveUsers: shieldedProcedure
    .input(UsersFindManySchema)
    .query(async ({ ctx: { prisma }, input }) => {
      const activeSubs = await prisma.descargasUser.findMany({
        where: {
          date_end: {
            gte: new Date(),
          },
        },
      });

      const activeUsers = await prisma.users.findMany({
        take: input.take,
        skip: input.skip,
        select: input.select,
        where: {
          AND: [
            {
              ...input.where,
            },
            {
              id: {
                in: activeSubs.map((user) => user.user_id),
              },
            },
          ],
        },
      });

      return activeUsers;
    }),
  getInactiveUsers: shieldedProcedure
    .input(UsersFindManySchema)
    .query(async ({ ctx: { prisma }, input }) => {
      const activeSubs = await prisma.descargasUser.findMany({
        where: {
          date_end: {
            gte: new Date(),
          },
        },
      });

      const inactiveUsers = await prisma.users.findMany({
        take: input.take,
        skip: input.skip,
        select: input.select,
        where: {
          AND: [
            {
              ...input.where,
            },
            {
              id: {
                notIn: activeSubs.map((user) => user.user_id),
              },
            },
          ],
        },
      });

      return inactiveUsers;
    }),
  blockUser: shieldedProcedure
    .input(
      z.object({
        userId: z.number(),
      }),
    )
    .mutation(async ({ ctx: { prisma }, input: { userId } }) => {
      const user = await prisma.users.findFirst({
        where: {
          id: userId,
        },
      });

      if (!user) {
        log.error(`[BLOCK_USER] User ${userId} not found`);
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Usuario no encontrado',
        });
      }

      try {
        log.info(`[BLOCK_USER] Canceling subscription for user ${userId}`);
        await cancelServicesSubscriptions({ prisma, user });
      } catch (e) {
        log.error(
          `[BLOCK_USER] Error cancelling subscription for user ${userId}, ${e}`,
        );
      }

      log.info(`[BLOCK_USER] Blocking user ${userId}`);

      await prisma.users.update({
        where: {
          id: user.id,
        },
        data: {
          blocked: true,
        },
      });

      return user;
    }),
  aggregateUsers: shieldedProcedure
    .input(UsersAggregateSchema)
    .query(async ({ ctx, input }) => {
      const aggregateUsers = await ctx.prisma.users.aggregate(input);
      return aggregateUsers;
    }),
  createManyUsers: shieldedProcedure
    .input(UsersCreateManySchema)
    .mutation(async ({ ctx, input }) => {
      const createManyUsers = await ctx.prisma.users.createMany(input);
      return createManyUsers;
    }),
  createOneUsers: shieldedProcedure
    .input(UsersCreateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const createOneUsers = await ctx.prisma.users.create(input);
      return createOneUsers;
    }),
  deleteManyUsers: shieldedProcedure
    .input(UsersDeleteManySchema)
    .mutation(async ({ ctx, input }) => {
      const deleteManyUsers = await ctx.prisma.users.deleteMany(input);
      return deleteManyUsers;
    }),
  deleteOneUsers: shieldedProcedure
    .input(UsersDeleteOneSchema)
    .mutation(async ({ ctx, input }) => {
      const deleteOneUsers = await ctx.prisma.users.delete(input);
      return deleteOneUsers;
    }),
  findFirstUsers: shieldedProcedure
    .input(UsersFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstUsers = await ctx.prisma.users.findFirst(input);
      return findFirstUsers;
    }),
  findFirstUsersOrThrow: shieldedProcedure
    .input(UsersFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstUsersOrThrow = await ctx.prisma.users.findFirstOrThrow(
        input,
      );
      return findFirstUsersOrThrow;
    }),
  findManyUsers: shieldedProcedure
    .input(UsersFindManySchema)
    .query(async ({ ctx, input }) => {
      const findManyUsers = await ctx.prisma.users.findMany(input);
      return findManyUsers;
    }),
  findUniqueUsers: shieldedProcedure
    .input(UsersFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueUsers = await ctx.prisma.users.findUnique(input);
      return findUniqueUsers;
    }),
  findUniqueUsersOrThrow: shieldedProcedure
    .input(UsersFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueUsersOrThrow = await ctx.prisma.users.findUniqueOrThrow(
        input,
      );
      return findUniqueUsersOrThrow;
    }),
  groupByUsers: shieldedProcedure
    .input(UsersGroupBySchema)
    .query(async ({ ctx, input }) => {
      const groupByUsers = await ctx.prisma.users.groupBy({
        where: input.where,
        orderBy: input.orderBy,
        by: input.by,
        having: input.having,
        take: input.take,
        skip: input.skip,
      });
      return groupByUsers;
    }),
  updateManyUsers: shieldedProcedure
    .input(UsersUpdateManySchema)
    .mutation(async ({ ctx, input }) => {
      const updateManyUsers = await ctx.prisma.users.updateMany(input);
      return updateManyUsers;
    }),
  updateOneUsers: shieldedProcedure
    .input(UsersUpdateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const updateOneUsers = await ctx.prisma.users.update(input);
      return updateOneUsers;
    }),
  upsertOneUsers: shieldedProcedure
    .input(UsersUpsertSchema)
    .mutation(async ({ ctx, input }) => {
      const upsertOneUsers = await ctx.prisma.users.upsert(input);
      return upsertOneUsers;
    }),
});
