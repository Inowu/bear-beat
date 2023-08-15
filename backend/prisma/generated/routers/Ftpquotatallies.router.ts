import { t, publicProcedure } from "./helpers/createRouter";
import { FtpquotatalliesAggregateSchema } from "../schemas/aggregateFtpquotatallies.schema";
import { FtpquotatalliesCreateManySchema } from "../schemas/createManyFtpquotatallies.schema";
import { FtpquotatalliesCreateOneSchema } from "../schemas/createOneFtpquotatallies.schema";
import { FtpquotatalliesDeleteManySchema } from "../schemas/deleteManyFtpquotatallies.schema";
import { FtpquotatalliesDeleteOneSchema } from "../schemas/deleteOneFtpquotatallies.schema";
import { FtpquotatalliesFindFirstSchema } from "../schemas/findFirstFtpquotatallies.schema";
import { FtpquotatalliesFindManySchema } from "../schemas/findManyFtpquotatallies.schema";
import { FtpquotatalliesFindUniqueSchema } from "../schemas/findUniqueFtpquotatallies.schema";
import { FtpquotatalliesGroupBySchema } from "../schemas/groupByFtpquotatallies.schema";
import { FtpquotatalliesUpdateManySchema } from "../schemas/updateManyFtpquotatallies.schema";
import { FtpquotatalliesUpdateOneSchema } from "../schemas/updateOneFtpquotatallies.schema";
import { FtpquotatalliesUpsertSchema } from "../schemas/upsertOneFtpquotatallies.schema";

export const ftpquotatalliesRouter = t.router({
  aggregateFtpquotatallies: publicProcedure
    .input(FtpquotatalliesAggregateSchema).query(async ({ ctx, input }) => {
      const aggregateFtpquotatallies = await ctx.prisma.ftpquotatallies.aggregate(input);
      return aggregateFtpquotatallies;
    }),
  createManyFtpquotatallies: publicProcedure
    .input(FtpquotatalliesCreateManySchema).mutation(async ({ ctx, input }) => {
      const createManyFtpquotatallies = await ctx.prisma.ftpquotatallies.createMany(input);
      return createManyFtpquotatallies;
    }),
  createOneFtpquotatallies: publicProcedure
    .input(FtpquotatalliesCreateOneSchema).mutation(async ({ ctx, input }) => {
      const createOneFtpquotatallies = await ctx.prisma.ftpquotatallies.create(input);
      return createOneFtpquotatallies;
    }),
  deleteManyFtpquotatallies: publicProcedure
    .input(FtpquotatalliesDeleteManySchema).mutation(async ({ ctx, input }) => {
      const deleteManyFtpquotatallies = await ctx.prisma.ftpquotatallies.deleteMany(input);
      return deleteManyFtpquotatallies;
    }),
  deleteOneFtpquotatallies: publicProcedure
    .input(FtpquotatalliesDeleteOneSchema).mutation(async ({ ctx, input }) => {
      const deleteOneFtpquotatallies = await ctx.prisma.ftpquotatallies.delete(input);
      return deleteOneFtpquotatallies;
    }),
  findFirstFtpquotatallies: publicProcedure
    .input(FtpquotatalliesFindFirstSchema).query(async ({ ctx, input }) => {
      const findFirstFtpquotatallies = await ctx.prisma.ftpquotatallies.findFirst(input);
      return findFirstFtpquotatallies;
    }),
  findFirstFtpquotatalliesOrThrow: publicProcedure
    .input(FtpquotatalliesFindFirstSchema).query(async ({ ctx, input }) => {
      const findFirstFtpquotatalliesOrThrow = await ctx.prisma.ftpquotatallies.findFirstOrThrow(input);
      return findFirstFtpquotatalliesOrThrow;
    }),
  findManyFtpquotatallies: publicProcedure
    .input(FtpquotatalliesFindManySchema).query(async ({ ctx, input }) => {
      const findManyFtpquotatallies = await ctx.prisma.ftpquotatallies.findMany(input);
      return findManyFtpquotatallies;
    }),
  findUniqueFtpquotatallies: publicProcedure
    .input(FtpquotatalliesFindUniqueSchema).query(async ({ ctx, input }) => {
      const findUniqueFtpquotatallies = await ctx.prisma.ftpquotatallies.findUnique(input);
      return findUniqueFtpquotatallies;
    }),
  findUniqueFtpquotatalliesOrThrow: publicProcedure
    .input(FtpquotatalliesFindUniqueSchema).query(async ({ ctx, input }) => {
      const findUniqueFtpquotatalliesOrThrow = await ctx.prisma.ftpquotatallies.findUniqueOrThrow(input);
      return findUniqueFtpquotatalliesOrThrow;
    }),
  groupByFtpquotatallies: publicProcedure
    .input(FtpquotatalliesGroupBySchema).query(async ({ ctx, input }) => {
      const groupByFtpquotatallies = await ctx.prisma.ftpquotatallies.groupBy({ where: input.where, orderBy: input.orderBy, by: input.by, having: input.having, take: input.take, skip: input.skip });
      return groupByFtpquotatallies;
    }),
  updateManyFtpquotatallies: publicProcedure
    .input(FtpquotatalliesUpdateManySchema).mutation(async ({ ctx, input }) => {
      const updateManyFtpquotatallies = await ctx.prisma.ftpquotatallies.updateMany(input);
      return updateManyFtpquotatallies;
    }),
  updateOneFtpquotatallies: publicProcedure
    .input(FtpquotatalliesUpdateOneSchema).mutation(async ({ ctx, input }) => {
      const updateOneFtpquotatallies = await ctx.prisma.ftpquotatallies.update(input);
      return updateOneFtpquotatallies;
    }),
  upsertOneFtpquotatallies: publicProcedure
    .input(FtpquotatalliesUpsertSchema).mutation(async ({ ctx, input }) => {
      const upsertOneFtpquotatallies = await ctx.prisma.ftpquotatallies.upsert(input);
      return upsertOneFtpquotatallies;
    }),

}) 
