import { t, publicProcedure } from "./helpers/createRouter";
import { FtpQuotaLimitsAggregateSchema } from "../schemas/aggregateFtpQuotaLimits.schema";
import { FtpQuotaLimitsCreateManySchema } from "../schemas/createManyFtpQuotaLimits.schema";
import { FtpQuotaLimitsCreateOneSchema } from "../schemas/createOneFtpQuotaLimits.schema";
import { FtpQuotaLimitsDeleteManySchema } from "../schemas/deleteManyFtpQuotaLimits.schema";
import { FtpQuotaLimitsDeleteOneSchema } from "../schemas/deleteOneFtpQuotaLimits.schema";
import { FtpQuotaLimitsFindFirstSchema } from "../schemas/findFirstFtpQuotaLimits.schema";
import { FtpQuotaLimitsFindManySchema } from "../schemas/findManyFtpQuotaLimits.schema";
import { FtpQuotaLimitsFindUniqueSchema } from "../schemas/findUniqueFtpQuotaLimits.schema";
import { FtpQuotaLimitsGroupBySchema } from "../schemas/groupByFtpQuotaLimits.schema";
import { FtpQuotaLimitsUpdateManySchema } from "../schemas/updateManyFtpQuotaLimits.schema";
import { FtpQuotaLimitsUpdateOneSchema } from "../schemas/updateOneFtpQuotaLimits.schema";
import { FtpQuotaLimitsUpsertSchema } from "../schemas/upsertOneFtpQuotaLimits.schema";

export const ftpquotalimitsRouter = t.router({
  aggregateFtpQuotaLimits: publicProcedure
    .input(FtpQuotaLimitsAggregateSchema).query(async ({ ctx, input }) => {
      const aggregateFtpQuotaLimits = await ctx.prisma.ftpQuotaLimits.aggregate(input);
      return aggregateFtpQuotaLimits;
    }),
  createManyFtpQuotaLimits: publicProcedure
    .input(FtpQuotaLimitsCreateManySchema).mutation(async ({ ctx, input }) => {
      const createManyFtpQuotaLimits = await ctx.prisma.ftpQuotaLimits.createMany(input);
      return createManyFtpQuotaLimits;
    }),
  createOneFtpQuotaLimits: publicProcedure
    .input(FtpQuotaLimitsCreateOneSchema).mutation(async ({ ctx, input }) => {
      const createOneFtpQuotaLimits = await ctx.prisma.ftpQuotaLimits.create(input);
      return createOneFtpQuotaLimits;
    }),
  deleteManyFtpQuotaLimits: publicProcedure
    .input(FtpQuotaLimitsDeleteManySchema).mutation(async ({ ctx, input }) => {
      const deleteManyFtpQuotaLimits = await ctx.prisma.ftpQuotaLimits.deleteMany(input);
      return deleteManyFtpQuotaLimits;
    }),
  deleteOneFtpQuotaLimits: publicProcedure
    .input(FtpQuotaLimitsDeleteOneSchema).mutation(async ({ ctx, input }) => {
      const deleteOneFtpQuotaLimits = await ctx.prisma.ftpQuotaLimits.delete(input);
      return deleteOneFtpQuotaLimits;
    }),
  findFirstFtpQuotaLimits: publicProcedure
    .input(FtpQuotaLimitsFindFirstSchema).query(async ({ ctx, input }) => {
      const findFirstFtpQuotaLimits = await ctx.prisma.ftpQuotaLimits.findFirst(input);
      return findFirstFtpQuotaLimits;
    }),
  findFirstFtpQuotaLimitsOrThrow: publicProcedure
    .input(FtpQuotaLimitsFindFirstSchema).query(async ({ ctx, input }) => {
      const findFirstFtpQuotaLimitsOrThrow = await ctx.prisma.ftpQuotaLimits.findFirstOrThrow(input);
      return findFirstFtpQuotaLimitsOrThrow;
    }),
  findManyFtpQuotaLimits: publicProcedure
    .input(FtpQuotaLimitsFindManySchema).query(async ({ ctx, input }) => {
      const findManyFtpQuotaLimits = await ctx.prisma.ftpQuotaLimits.findMany(input);
      return findManyFtpQuotaLimits;
    }),
  findUniqueFtpQuotaLimits: publicProcedure
    .input(FtpQuotaLimitsFindUniqueSchema).query(async ({ ctx, input }) => {
      const findUniqueFtpQuotaLimits = await ctx.prisma.ftpQuotaLimits.findUnique(input);
      return findUniqueFtpQuotaLimits;
    }),
  findUniqueFtpQuotaLimitsOrThrow: publicProcedure
    .input(FtpQuotaLimitsFindUniqueSchema).query(async ({ ctx, input }) => {
      const findUniqueFtpQuotaLimitsOrThrow = await ctx.prisma.ftpQuotaLimits.findUniqueOrThrow(input);
      return findUniqueFtpQuotaLimitsOrThrow;
    }),
  groupByFtpQuotaLimits: publicProcedure
    .input(FtpQuotaLimitsGroupBySchema).query(async ({ ctx, input }) => {
      const groupByFtpQuotaLimits = await ctx.prisma.ftpQuotaLimits.groupBy({ where: input.where, orderBy: input.orderBy, by: input.by, having: input.having, take: input.take, skip: input.skip });
      return groupByFtpQuotaLimits;
    }),
  updateManyFtpQuotaLimits: publicProcedure
    .input(FtpQuotaLimitsUpdateManySchema).mutation(async ({ ctx, input }) => {
      const updateManyFtpQuotaLimits = await ctx.prisma.ftpQuotaLimits.updateMany(input);
      return updateManyFtpQuotaLimits;
    }),
  updateOneFtpQuotaLimits: publicProcedure
    .input(FtpQuotaLimitsUpdateOneSchema).mutation(async ({ ctx, input }) => {
      const updateOneFtpQuotaLimits = await ctx.prisma.ftpQuotaLimits.update(input);
      return updateOneFtpQuotaLimits;
    }),
  upsertOneFtpQuotaLimits: publicProcedure
    .input(FtpQuotaLimitsUpsertSchema).mutation(async ({ ctx, input }) => {
      const upsertOneFtpQuotaLimits = await ctx.prisma.ftpQuotaLimits.upsert(input);
      return upsertOneFtpQuotaLimits;
    }),

}) 
