import { t, publicProcedure } from "./helpers/createRouter";
import { FtpQuotaTalliesHistoryAggregateSchema } from "../schemas/aggregateFtpQuotaTalliesHistory.schema";
import { FtpQuotaTalliesHistoryCreateManySchema } from "../schemas/createManyFtpQuotaTalliesHistory.schema";
import { FtpQuotaTalliesHistoryCreateOneSchema } from "../schemas/createOneFtpQuotaTalliesHistory.schema";
import { FtpQuotaTalliesHistoryDeleteManySchema } from "../schemas/deleteManyFtpQuotaTalliesHistory.schema";
import { FtpQuotaTalliesHistoryDeleteOneSchema } from "../schemas/deleteOneFtpQuotaTalliesHistory.schema";
import { FtpQuotaTalliesHistoryFindFirstSchema } from "../schemas/findFirstFtpQuotaTalliesHistory.schema";
import { FtpQuotaTalliesHistoryFindManySchema } from "../schemas/findManyFtpQuotaTalliesHistory.schema";
import { FtpQuotaTalliesHistoryFindUniqueSchema } from "../schemas/findUniqueFtpQuotaTalliesHistory.schema";
import { FtpQuotaTalliesHistoryGroupBySchema } from "../schemas/groupByFtpQuotaTalliesHistory.schema";
import { FtpQuotaTalliesHistoryUpdateManySchema } from "../schemas/updateManyFtpQuotaTalliesHistory.schema";
import { FtpQuotaTalliesHistoryUpdateOneSchema } from "../schemas/updateOneFtpQuotaTalliesHistory.schema";
import { FtpQuotaTalliesHistoryUpsertSchema } from "../schemas/upsertOneFtpQuotaTalliesHistory.schema";

export const ftpquotatallieshistoriesRouter = t.router({
  aggregateFtpQuotaTalliesHistory: publicProcedure
    .input(FtpQuotaTalliesHistoryAggregateSchema).query(async ({ ctx, input }) => {
      const aggregateFtpQuotaTalliesHistory = await ctx.prisma.ftpQuotaTalliesHistory.aggregate(input);
      return aggregateFtpQuotaTalliesHistory;
    }),
  createManyFtpQuotaTalliesHistory: publicProcedure
    .input(FtpQuotaTalliesHistoryCreateManySchema).mutation(async ({ ctx, input }) => {
      const createManyFtpQuotaTalliesHistory = await ctx.prisma.ftpQuotaTalliesHistory.createMany(input);
      return createManyFtpQuotaTalliesHistory;
    }),
  createOneFtpQuotaTalliesHistory: publicProcedure
    .input(FtpQuotaTalliesHistoryCreateOneSchema).mutation(async ({ ctx, input }) => {
      const createOneFtpQuotaTalliesHistory = await ctx.prisma.ftpQuotaTalliesHistory.create(input);
      return createOneFtpQuotaTalliesHistory;
    }),
  deleteManyFtpQuotaTalliesHistory: publicProcedure
    .input(FtpQuotaTalliesHistoryDeleteManySchema).mutation(async ({ ctx, input }) => {
      const deleteManyFtpQuotaTalliesHistory = await ctx.prisma.ftpQuotaTalliesHistory.deleteMany(input);
      return deleteManyFtpQuotaTalliesHistory;
    }),
  deleteOneFtpQuotaTalliesHistory: publicProcedure
    .input(FtpQuotaTalliesHistoryDeleteOneSchema).mutation(async ({ ctx, input }) => {
      const deleteOneFtpQuotaTalliesHistory = await ctx.prisma.ftpQuotaTalliesHistory.delete(input);
      return deleteOneFtpQuotaTalliesHistory;
    }),
  findFirstFtpQuotaTalliesHistory: publicProcedure
    .input(FtpQuotaTalliesHistoryFindFirstSchema).query(async ({ ctx, input }) => {
      const findFirstFtpQuotaTalliesHistory = await ctx.prisma.ftpQuotaTalliesHistory.findFirst(input);
      return findFirstFtpQuotaTalliesHistory;
    }),
  findFirstFtpQuotaTalliesHistoryOrThrow: publicProcedure
    .input(FtpQuotaTalliesHistoryFindFirstSchema).query(async ({ ctx, input }) => {
      const findFirstFtpQuotaTalliesHistoryOrThrow = await ctx.prisma.ftpQuotaTalliesHistory.findFirstOrThrow(input);
      return findFirstFtpQuotaTalliesHistoryOrThrow;
    }),
  findManyFtpQuotaTalliesHistory: publicProcedure
    .input(FtpQuotaTalliesHistoryFindManySchema).query(async ({ ctx, input }) => {
      const findManyFtpQuotaTalliesHistory = await ctx.prisma.ftpQuotaTalliesHistory.findMany(input);
      return findManyFtpQuotaTalliesHistory;
    }),
  findUniqueFtpQuotaTalliesHistory: publicProcedure
    .input(FtpQuotaTalliesHistoryFindUniqueSchema).query(async ({ ctx, input }) => {
      const findUniqueFtpQuotaTalliesHistory = await ctx.prisma.ftpQuotaTalliesHistory.findUnique(input);
      return findUniqueFtpQuotaTalliesHistory;
    }),
  findUniqueFtpQuotaTalliesHistoryOrThrow: publicProcedure
    .input(FtpQuotaTalliesHistoryFindUniqueSchema).query(async ({ ctx, input }) => {
      const findUniqueFtpQuotaTalliesHistoryOrThrow = await ctx.prisma.ftpQuotaTalliesHistory.findUniqueOrThrow(input);
      return findUniqueFtpQuotaTalliesHistoryOrThrow;
    }),
  groupByFtpQuotaTalliesHistory: publicProcedure
    .input(FtpQuotaTalliesHistoryGroupBySchema).query(async ({ ctx, input }) => {
      const groupByFtpQuotaTalliesHistory = await ctx.prisma.ftpQuotaTalliesHistory.groupBy({ where: input.where, orderBy: input.orderBy, by: input.by, having: input.having, take: input.take, skip: input.skip });
      return groupByFtpQuotaTalliesHistory;
    }),
  updateManyFtpQuotaTalliesHistory: publicProcedure
    .input(FtpQuotaTalliesHistoryUpdateManySchema).mutation(async ({ ctx, input }) => {
      const updateManyFtpQuotaTalliesHistory = await ctx.prisma.ftpQuotaTalliesHistory.updateMany(input);
      return updateManyFtpQuotaTalliesHistory;
    }),
  updateOneFtpQuotaTalliesHistory: publicProcedure
    .input(FtpQuotaTalliesHistoryUpdateOneSchema).mutation(async ({ ctx, input }) => {
      const updateOneFtpQuotaTalliesHistory = await ctx.prisma.ftpQuotaTalliesHistory.update(input);
      return updateOneFtpQuotaTalliesHistory;
    }),
  upsertOneFtpQuotaTalliesHistory: publicProcedure
    .input(FtpQuotaTalliesHistoryUpsertSchema).mutation(async ({ ctx, input }) => {
      const upsertOneFtpQuotaTalliesHistory = await ctx.prisma.ftpQuotaTalliesHistory.upsert(input);
      return upsertOneFtpQuotaTalliesHistory;
    }),

}) 
