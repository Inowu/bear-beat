import { shieldedProcedure } from '../procedures/shielded.procedure';
import { TRPCError } from '@trpc/server';
import { router } from '../trpc';
import { gbToBytes } from '../utils/gbToBytes';
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
import { any, bigint, z } from 'zod';
import { bool } from 'yup';
import { UserFilesDeleteManySchema } from '../schemas';

export const usersRouter = router({
  blockUser: shieldedProcedure
    .input(
      z.object({
        userId: z.number(),
      }),
    )
    .mutation(async ({ ctx: { prisma }, input }) => {
      // Get user from database
      // If user does not exist, throw error
      const user = await prisma.users.findFirst({
        where: {
          id: input.userId,
        },
      });
      if (!user) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'El usuario no existe',
        });
      }
      // Check if user is already blocked
      // If user is already blocked, throw error
      const blockedUser = await prisma.users.findMany({
        where: {
          blocked: true,
        },
      });

      if (blockedUser) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Usuario Bloqueado',
        });
      }

      // Search for user's ftp account (ftpuser)
      //      -- userid (The name of the ftpuser account)
      //      -- user_id (The id of the user)
      const ftpUser = await prisma.ftpUser.findFirst({
        where: {
          user_id: input.userId,
        },
      })
      // If user's ftp account does not exist, throw error
      if (!ftpUser) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'Este usuario no tiene cuenta FTP',
        });
      }
      // Search for ftp quota tallies (ftpquotatallies)
      //     -- name (The name of the ftpuser account)
      //     -- bytes_out_used (The amount of bytes downloaded by the user)
      const ftpQuotaTallies = await prisma.ftpquotatallies.findFirst({
        where: {
          name: ftpUser.userid,
        },
      })
      // If user's ftp quota tallies does not exist, throw error
      if (!ftpQuotaTallies) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'El usuario no tiene cuotas disponibles',
        });
      }
      // Search for descargas_user entry using user_id (descargas_user)
      const descargasUser = await prisma.descargasUser.findFirst({
        where: {
          AND: [
            {
              user_id: input.userId,
            },
            {
              date_end: {
                gt: new Date(),
              },
            },
          ],
        },
      });

      // If descargas_user entry does not exist, throw error (Usuario no tiene subscripcion)
      if (!descargasUser) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'El usuario no tiene subscripcion',
        });
      }
      
      if(descargasUser.order_id == undefined){
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'El usuario no tiene orden',
        });
      }
      // Search for order associated to descargas_user entry using order_id (orders)
      const orderAssociated = await prisma.orders.findFirst({
        where: {
          id: descargasUser.order_id,
        },
      });
      // If order does not exist, throw error (Usuario no tiene orden)
      if (!orderAssociated) {
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'El usuario no tiene orden',
        });
      }
      if(orderAssociated.plan_id == undefined){
        throw new TRPCError({
          code: 'UNAUTHORIZED',
          message: 'La orden no tiene plan',
        });
      }
      // Search for plan associated to order
      const planAssociated = await prisma.plans.findFirst({
        where: {
          id: orderAssociated.plan_id,
        },
      });
      // Get plan bytes (plan.gigas)
      const planBytes = await prisma.plans.findFirst({
        where: {
          
        },
      });
      // Use utility method to convert gb to bytes (gbToBytes)
      // Set bytes_out_used to the number of bytes in the plan
      
      // Set date_end in descargas_user to current_date
      // * Note:
      // * User's table: users
      // * User's subscription table: descargas_user
      // * User's quota table: ftpquotatallies
      // * User's ftp account table: ftpuser
      // * User's order table: orders
      // * User's plan table: plan
    }),
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
