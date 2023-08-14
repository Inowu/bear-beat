import { shieldedProcedure } from "../procedures/shielded.procedure";
import { router } from "../trpc";
import { FtpQuotatAlliesHistoryAggregateSchema } from "../schemas/aggregateFtpQuotatAlliesHistory.schema";
import { FtpQuotatAlliesHistoryCreateManySchema } from "../schemas/createManyFtpQuotatAlliesHistory.schema";
import { FtpQuotatAlliesHistoryCreateOneSchema } from "../schemas/createOneFtpQuotatAlliesHistory.schema";
import { FtpQuotatAlliesHistoryDeleteManySchema } from "../schemas/deleteManyFtpQuotatAlliesHistory.schema";
import { FtpQuotatAlliesHistoryDeleteOneSchema } from "../schemas/deleteOneFtpQuotatAlliesHistory.schema";
import { FtpQuotatAlliesHistoryFindFirstSchema } from "../schemas/findFirstFtpQuotatAlliesHistory.schema";
import { FtpQuotatAlliesHistoryFindManySchema } from "../schemas/findManyFtpQuotatAlliesHistory.schema";
import { FtpQuotatAlliesHistoryFindUniqueSchema } from "../schemas/findUniqueFtpQuotatAlliesHistory.schema";
import { FtpQuotatAlliesHistoryGroupBySchema } from "../schemas/groupByFtpQuotatAlliesHistory.schema";
import { FtpQuotatAlliesHistoryUpdateManySchema } from "../schemas/updateManyFtpQuotatAlliesHistory.schema";
import { FtpQuotatAlliesHistoryUpdateOneSchema } from "../schemas/updateOneFtpQuotatAlliesHistory.schema";
import { FtpQuotatAlliesHistoryUpsertSchema } from "../schemas/upsertOneFtpQuotatAlliesHistory.schema";

export const ftpquotatallieshistoriesRouter = router({
  aggregateFtpQuotatAlliesHistory: shieldedProcedure
    .input(FtpQuotatAlliesHistoryAggregateSchema)
    .query(async ({ ctx, input }) => {
      const aggregateFtpQuotatAlliesHistory =
        await ctx.prisma.ftpQuotatAlliesHistory.aggregate(input);
      return aggregateFtpQuotatAlliesHistory;
    }),
  createManyFtpQuotatAlliesHistory: shieldedProcedure
    .input(FtpQuotatAlliesHistoryCreateManySchema)
    .mutation(async ({ ctx, input }) => {
      const createManyFtpQuotatAlliesHistory =
        await ctx.prisma.ftpQuotatAlliesHistory.createMany(input);
      return createManyFtpQuotatAlliesHistory;
    }),
  createOneFtpQuotatAlliesHistory: shieldedProcedure
    .input(FtpQuotatAlliesHistoryCreateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const createOneFtpQuotatAlliesHistory =
        await ctx.prisma.ftpQuotatAlliesHistory.create(input);
      return createOneFtpQuotatAlliesHistory;
    }),
  deleteManyFtpQuotatAlliesHistory: shieldedProcedure
    .input(FtpQuotatAlliesHistoryDeleteManySchema)
    .mutation(async ({ ctx, input }) => {
      const deleteManyFtpQuotatAlliesHistory =
        await ctx.prisma.ftpQuotatAlliesHistory.deleteMany(input);
      return deleteManyFtpQuotatAlliesHistory;
    }),
  deleteOneFtpQuotatAlliesHistory: shieldedProcedure
    .input(FtpQuotatAlliesHistoryDeleteOneSchema)
    .mutation(async ({ ctx, input }) => {
      const deleteOneFtpQuotatAlliesHistory =
        await ctx.prisma.ftpQuotatAlliesHistory.delete(input);
      return deleteOneFtpQuotatAlliesHistory;
    }),
  findFirstFtpQuotatAlliesHistory: shieldedProcedure
    .input(FtpQuotatAlliesHistoryFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstFtpQuotatAlliesHistory =
        await ctx.prisma.ftpQuotatAlliesHistory.findFirst(input);
      return findFirstFtpQuotatAlliesHistory;
    }),
  findFirstFtpQuotatAlliesHistoryOrThrow: shieldedProcedure
    .input(FtpQuotatAlliesHistoryFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstFtpQuotatAlliesHistoryOrThrow =
        await ctx.prisma.ftpQuotatAlliesHistory.findFirstOrThrow(input);
      return findFirstFtpQuotatAlliesHistoryOrThrow;
    }),
  findManyFtpQuotatAlliesHistory: shieldedProcedure
    .input(FtpQuotatAlliesHistoryFindManySchema)
    .query(async ({ ctx, input }) => {
      const findManyFtpQuotatAlliesHistory =
        await ctx.prisma.ftpQuotatAlliesHistory.findMany(input);
      return findManyFtpQuotatAlliesHistory;
    }),
  findUniqueFtpQuotatAlliesHistory: shieldedProcedure
    .input(FtpQuotatAlliesHistoryFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueFtpQuotatAlliesHistory =
        await ctx.prisma.ftpQuotatAlliesHistory.findUnique(input);
      return findUniqueFtpQuotatAlliesHistory;
    }),
  findUniqueFtpQuotatAlliesHistoryOrThrow: shieldedProcedure
    .input(FtpQuotatAlliesHistoryFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueFtpQuotatAlliesHistoryOrThrow =
        await ctx.prisma.ftpQuotatAlliesHistory.findUniqueOrThrow(input);
      return findUniqueFtpQuotatAlliesHistoryOrThrow;
    }),
  groupByFtpQuotatAlliesHistory: shieldedProcedure
    .input(FtpQuotatAlliesHistoryGroupBySchema)
    .query(async ({ ctx, input }) => {
      const groupByFtpQuotatAlliesHistory =
        await ctx.prisma.ftpQuotatAlliesHistory.groupBy({
          where: input.where,
          orderBy: input.orderBy,
          by: input.by,
          having: input.having,
          take: input.take,
          skip: input.skip,
        });
      return groupByFtpQuotatAlliesHistory;
    }),
  updateManyFtpQuotatAlliesHistory: shieldedProcedure
    .input(FtpQuotatAlliesHistoryUpdateManySchema)
    .mutation(async ({ ctx, input }) => {
      const updateManyFtpQuotatAlliesHistory =
        await ctx.prisma.ftpQuotatAlliesHistory.updateMany(input);
      return updateManyFtpQuotatAlliesHistory;
    }),
  updateOneFtpQuotatAlliesHistory: shieldedProcedure
    .input(FtpQuotatAlliesHistoryUpdateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const updateOneFtpQuotatAlliesHistory =
        await ctx.prisma.ftpQuotatAlliesHistory.update(input);
      return updateOneFtpQuotatAlliesHistory;
    }),
  upsertOneFtpQuotatAlliesHistory: shieldedProcedure
    .input(FtpQuotatAlliesHistoryUpsertSchema)
    .mutation(async ({ ctx, input }) => {
      const upsertOneFtpQuotatAlliesHistory =
        await ctx.prisma.ftpQuotatAlliesHistory.upsert(input);
      return upsertOneFtpQuotatAlliesHistory;
    }),
});
