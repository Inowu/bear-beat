import { t, publicProcedure } from "./helpers/createRouter";
import { UsersAggregateSchema } from "../schemas/aggregateUsers.schema";
import { UsersCreateManySchema } from "../schemas/createManyUsers.schema";
import { UsersCreateOneSchema } from "../schemas/createOneUsers.schema";
import { UsersDeleteManySchema } from "../schemas/deleteManyUsers.schema";
import { UsersDeleteOneSchema } from "../schemas/deleteOneUsers.schema";
import { UsersFindFirstSchema } from "../schemas/findFirstUsers.schema";
import { UsersFindManySchema } from "../schemas/findManyUsers.schema";
import { UsersFindUniqueSchema } from "../schemas/findUniqueUsers.schema";
import { UsersGroupBySchema } from "../schemas/groupByUsers.schema";
import { UsersUpdateManySchema } from "../schemas/updateManyUsers.schema";
import { UsersUpdateOneSchema } from "../schemas/updateOneUsers.schema";
import { UsersUpsertSchema } from "../schemas/upsertOneUsers.schema";

export const usersRouter = t.router({
  aggregateUsers: publicProcedure
    .input(UsersAggregateSchema).query(async ({ ctx, input }) => {
      const aggregateUsers = await ctx.prisma.users.aggregate(input);
      return aggregateUsers;
    }),
  createManyUsers: publicProcedure
    .input(UsersCreateManySchema).mutation(async ({ ctx, input }) => {
      const createManyUsers = await ctx.prisma.users.createMany(input);
      return createManyUsers;
    }),
  createOneUsers: publicProcedure
    .input(UsersCreateOneSchema).mutation(async ({ ctx, input }) => {
      const createOneUsers = await ctx.prisma.users.create(input);
      return createOneUsers;
    }),
  deleteManyUsers: publicProcedure
    .input(UsersDeleteManySchema).mutation(async ({ ctx, input }) => {
      const deleteManyUsers = await ctx.prisma.users.deleteMany(input);
      return deleteManyUsers;
    }),
  deleteOneUsers: publicProcedure
    .input(UsersDeleteOneSchema).mutation(async ({ ctx, input }) => {
      const deleteOneUsers = await ctx.prisma.users.delete(input);
      return deleteOneUsers;
    }),
  findFirstUsers: publicProcedure
    .input(UsersFindFirstSchema).query(async ({ ctx, input }) => {
      const findFirstUsers = await ctx.prisma.users.findFirst(input);
      return findFirstUsers;
    }),
  findFirstUsersOrThrow: publicProcedure
    .input(UsersFindFirstSchema).query(async ({ ctx, input }) => {
      const findFirstUsersOrThrow = await ctx.prisma.users.findFirstOrThrow(input);
      return findFirstUsersOrThrow;
    }),
  findManyUsers: publicProcedure
    .input(UsersFindManySchema).query(async ({ ctx, input }) => {
      const findManyUsers = await ctx.prisma.users.findMany(input);
      return findManyUsers;
    }),
  findUniqueUsers: publicProcedure
    .input(UsersFindUniqueSchema).query(async ({ ctx, input }) => {
      const findUniqueUsers = await ctx.prisma.users.findUnique(input);
      return findUniqueUsers;
    }),
  findUniqueUsersOrThrow: publicProcedure
    .input(UsersFindUniqueSchema).query(async ({ ctx, input }) => {
      const findUniqueUsersOrThrow = await ctx.prisma.users.findUniqueOrThrow(input);
      return findUniqueUsersOrThrow;
    }),
  groupByUsers: publicProcedure
    .input(UsersGroupBySchema).query(async ({ ctx, input }) => {
      const groupByUsers = await ctx.prisma.users.groupBy({ where: input.where, orderBy: input.orderBy, by: input.by, having: input.having, take: input.take, skip: input.skip });
      return groupByUsers;
    }),
  updateManyUsers: publicProcedure
    .input(UsersUpdateManySchema).mutation(async ({ ctx, input }) => {
      const updateManyUsers = await ctx.prisma.users.updateMany(input);
      return updateManyUsers;
    }),
  updateOneUsers: publicProcedure
    .input(UsersUpdateOneSchema).mutation(async ({ ctx, input }) => {
      const updateOneUsers = await ctx.prisma.users.update(input);
      return updateOneUsers;
    }),
  upsertOneUsers: publicProcedure
    .input(UsersUpsertSchema).mutation(async ({ ctx, input }) => {
      const upsertOneUsers = await ctx.prisma.users.upsert(input);
      return upsertOneUsers;
    }),

}) 
