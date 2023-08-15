import { router } from '../trpc';
import { shieldedProcedure } from '../procedures/shielded.procedure';
import { FtpquotatalliesAggregateSchema } from '../schemas/aggregateFtpquotatallies.schema';
import { FtpquotatalliesCreateManySchema } from '../schemas/createManyFtpquotatallies.schema';
import { FtpquotatalliesCreateOneSchema } from '../schemas/createOneFtpquotatallies.schema';
import { FtpquotatalliesDeleteManySchema } from '../schemas/deleteManyFtpquotatallies.schema';
import { FtpquotatalliesDeleteOneSchema } from '../schemas/deleteOneFtpquotatallies.schema';
import { FtpquotatalliesFindFirstSchema } from '../schemas/findFirstFtpquotatallies.schema';
import { FtpquotatalliesFindManySchema } from '../schemas/findManyFtpquotatallies.schema';
import { FtpquotatalliesFindUniqueSchema } from '../schemas/findUniqueFtpquotatallies.schema';
import { FtpquotatalliesGroupBySchema } from '../schemas/groupByFtpquotatallies.schema';
import { FtpquotatalliesUpdateManySchema } from '../schemas/updateManyFtpquotatallies.schema';
import { FtpquotatalliesUpdateOneSchema } from '../schemas/updateOneFtpquotatallies.schema';
import { FtpquotatalliesUpsertSchema } from '../schemas/upsertOneFtpquotatallies.schema';

export const ftpquotatalliesRouter = router({
  aggregateFtpquotatallies: shieldedProcedure
    .input(FtpquotatalliesAggregateSchema)
    .query(async ({ ctx, input }) => {
      const aggregateFtpquotatallies =
        await ctx.prisma.ftpquotatallies.aggregate(input);
      return aggregateFtpquotatallies;
    }),
  createManyFtpquotatallies: shieldedProcedure
    .input(FtpquotatalliesCreateManySchema)
    .mutation(async ({ ctx, input }) => {
      const createManyFtpquotatallies =
        await ctx.prisma.ftpquotatallies.createMany(input);
      return createManyFtpquotatallies;
    }),
  createOneFtpquotatallies: shieldedProcedure
    .input(FtpquotatalliesCreateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const createOneFtpquotatallies = await ctx.prisma.ftpquotatallies.create(
        input,
      );
      return createOneFtpquotatallies;
    }),
  deleteManyFtpquotatallies: shieldedProcedure
    .input(FtpquotatalliesDeleteManySchema)
    .mutation(async ({ ctx, input }) => {
      const deleteManyFtpquotatallies =
        await ctx.prisma.ftpquotatallies.deleteMany(input);
      return deleteManyFtpquotatallies;
    }),
  deleteOneFtpquotatallies: shieldedProcedure
    .input(FtpquotatalliesDeleteOneSchema)
    .mutation(async ({ ctx, input }) => {
      const deleteOneFtpquotatallies = await ctx.prisma.ftpquotatallies.delete(
        input,
      );
      return deleteOneFtpquotatallies;
    }),
  findFirstFtpquotatallies: shieldedProcedure
    .input(FtpquotatalliesFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstFtpquotatallies =
        await ctx.prisma.ftpquotatallies.findFirst(input);
      return findFirstFtpquotatallies;
    }),
  findFirstFtpquotatalliesOrThrow: shieldedProcedure
    .input(FtpquotatalliesFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstFtpquotatalliesOrThrow =
        await ctx.prisma.ftpquotatallies.findFirstOrThrow(input);
      return findFirstFtpquotatalliesOrThrow;
    }),
  findManyFtpquotatallies: shieldedProcedure
    .input(FtpquotatalliesFindManySchema)
    .query(async ({ ctx, input }) => {
      const findManyFtpquotatallies = await ctx.prisma.ftpquotatallies.findMany(
        input,
      );
      return findManyFtpquotatallies;
    }),
  findUniqueFtpquotatallies: shieldedProcedure
    .input(FtpquotatalliesFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueFtpquotatallies =
        await ctx.prisma.ftpquotatallies.findUnique(input);
      return findUniqueFtpquotatallies;
    }),
  findUniqueFtpquotatalliesOrThrow: shieldedProcedure
    .input(FtpquotatalliesFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueFtpquotatalliesOrThrow =
        await ctx.prisma.ftpquotatallies.findUniqueOrThrow(input);
      return findUniqueFtpquotatalliesOrThrow;
    }),
  groupByFtpquotatallies: shieldedProcedure
    .input(FtpquotatalliesGroupBySchema)
    .query(async ({ ctx, input }) => {
      const groupByFtpquotatallies = await ctx.prisma.ftpquotatallies.groupBy({
        where: input.where,
        orderBy: input.orderBy,
        by: input.by,
        having: input.having,
        take: input.take,
        skip: input.skip,
      });
      return groupByFtpquotatallies;
    }),
  updateManyFtpquotatallies: shieldedProcedure
    .input(FtpquotatalliesUpdateManySchema)
    .mutation(async ({ ctx, input }) => {
      const updateManyFtpquotatallies =
        await ctx.prisma.ftpquotatallies.updateMany(input);
      return updateManyFtpquotatallies;
    }),
  updateOneFtpquotatallies: shieldedProcedure
    .input(FtpquotatalliesUpdateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const updateOneFtpquotatallies = await ctx.prisma.ftpquotatallies.update(
        input,
      );
      return updateOneFtpquotatallies;
    }),
  upsertOneFtpquotatallies: shieldedProcedure
    .input(FtpquotatalliesUpsertSchema)
    .mutation(async ({ ctx, input }) => {
      const upsertOneFtpquotatallies = await ctx.prisma.ftpquotatallies.upsert(
        input,
      );
      return upsertOneFtpquotatallies;
    }),
});
