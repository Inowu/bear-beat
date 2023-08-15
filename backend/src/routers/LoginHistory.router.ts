import { shieldedProcedure } from '../procedures/shielded.procedure';
import { router } from '../trpc';
import { LoginHistoryAggregateSchema } from '../schemas/aggregateLoginHistory.schema';
import { LoginHistoryCreateManySchema } from '../schemas/createManyLoginHistory.schema';
import { LoginHistoryCreateOneSchema } from '../schemas/createOneLoginHistory.schema';
import { LoginHistoryDeleteManySchema } from '../schemas/deleteManyLoginHistory.schema';
import { LoginHistoryDeleteOneSchema } from '../schemas/deleteOneLoginHistory.schema';
import { LoginHistoryFindFirstSchema } from '../schemas/findFirstLoginHistory.schema';
import { LoginHistoryFindManySchema } from '../schemas/findManyLoginHistory.schema';
import { LoginHistoryFindUniqueSchema } from '../schemas/findUniqueLoginHistory.schema';
import { LoginHistoryGroupBySchema } from '../schemas/groupByLoginHistory.schema';
import { LoginHistoryUpdateManySchema } from '../schemas/updateManyLoginHistory.schema';
import { LoginHistoryUpdateOneSchema } from '../schemas/updateOneLoginHistory.schema';
import { LoginHistoryUpsertSchema } from '../schemas/upsertOneLoginHistory.schema';

export const loginhistoriesRouter = router({
  aggregateLoginHistory: shieldedProcedure
    .input(LoginHistoryAggregateSchema)
    .query(async ({ ctx, input }) => {
      const aggregateLoginHistory = await ctx.prisma.loginHistory.aggregate(
        input,
      );
      return aggregateLoginHistory;
    }),
  createManyLoginHistory: shieldedProcedure
    .input(LoginHistoryCreateManySchema)
    .mutation(async ({ ctx, input }) => {
      const createManyLoginHistory = await ctx.prisma.loginHistory.createMany(
        input,
      );
      return createManyLoginHistory;
    }),
  createOneLoginHistory: shieldedProcedure
    .input(LoginHistoryCreateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const createOneLoginHistory = await ctx.prisma.loginHistory.create(input);
      return createOneLoginHistory;
    }),
  deleteManyLoginHistory: shieldedProcedure
    .input(LoginHistoryDeleteManySchema)
    .mutation(async ({ ctx, input }) => {
      const deleteManyLoginHistory = await ctx.prisma.loginHistory.deleteMany(
        input,
      );
      return deleteManyLoginHistory;
    }),
  deleteOneLoginHistory: shieldedProcedure
    .input(LoginHistoryDeleteOneSchema)
    .mutation(async ({ ctx, input }) => {
      const deleteOneLoginHistory = await ctx.prisma.loginHistory.delete(input);
      return deleteOneLoginHistory;
    }),
  findFirstLoginHistory: shieldedProcedure
    .input(LoginHistoryFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstLoginHistory = await ctx.prisma.loginHistory.findFirst(
        input,
      );
      return findFirstLoginHistory;
    }),
  findFirstLoginHistoryOrThrow: shieldedProcedure
    .input(LoginHistoryFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstLoginHistoryOrThrow =
        await ctx.prisma.loginHistory.findFirstOrThrow(input);
      return findFirstLoginHistoryOrThrow;
    }),
  findManyLoginHistory: shieldedProcedure
    .input(LoginHistoryFindManySchema)
    .query(async ({ ctx, input }) => {
      const findManyLoginHistory = await ctx.prisma.loginHistory.findMany(
        input,
      );
      return findManyLoginHistory;
    }),
  findUniqueLoginHistory: shieldedProcedure
    .input(LoginHistoryFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueLoginHistory = await ctx.prisma.loginHistory.findUnique(
        input,
      );
      return findUniqueLoginHistory;
    }),
  findUniqueLoginHistoryOrThrow: shieldedProcedure
    .input(LoginHistoryFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueLoginHistoryOrThrow =
        await ctx.prisma.loginHistory.findUniqueOrThrow(input);
      return findUniqueLoginHistoryOrThrow;
    }),
  groupByLoginHistory: shieldedProcedure
    .input(LoginHistoryGroupBySchema)
    .query(async ({ ctx, input }) => {
      const groupByLoginHistory = await ctx.prisma.loginHistory.groupBy({
        where: input.where,
        orderBy: input.orderBy,
        by: input.by,
        having: input.having,
        take: input.take,
        skip: input.skip,
      });
      return groupByLoginHistory;
    }),
  updateManyLoginHistory: shieldedProcedure
    .input(LoginHistoryUpdateManySchema)
    .mutation(async ({ ctx, input }) => {
      const updateManyLoginHistory = await ctx.prisma.loginHistory.updateMany(
        input,
      );
      return updateManyLoginHistory;
    }),
  updateOneLoginHistory: shieldedProcedure
    .input(LoginHistoryUpdateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const updateOneLoginHistory = await ctx.prisma.loginHistory.update(input);
      return updateOneLoginHistory;
    }),
  upsertOneLoginHistory: shieldedProcedure
    .input(LoginHistoryUpsertSchema)
    .mutation(async ({ ctx, input }) => {
      const upsertOneLoginHistory = await ctx.prisma.loginHistory.upsert(input);
      return upsertOneLoginHistory;
    }),
});
