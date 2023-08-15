import { shieldedProcedure } from '../procedures/shielded.procedure';
import { router } from '../trpc';
import { CuponsUsedAggregateSchema } from '../schemas/aggregateCuponsUsed.schema';
import { CuponsUsedCreateManySchema } from '../schemas/createManyCuponsUsed.schema';
import { CuponsUsedCreateOneSchema } from '../schemas/createOneCuponsUsed.schema';
import { CuponsUsedDeleteManySchema } from '../schemas/deleteManyCuponsUsed.schema';
import { CuponsUsedDeleteOneSchema } from '../schemas/deleteOneCuponsUsed.schema';
import { CuponsUsedFindFirstSchema } from '../schemas/findFirstCuponsUsed.schema';
import { CuponsUsedFindManySchema } from '../schemas/findManyCuponsUsed.schema';
import { CuponsUsedFindUniqueSchema } from '../schemas/findUniqueCuponsUsed.schema';
import { CuponsUsedGroupBySchema } from '../schemas/groupByCuponsUsed.schema';
import { CuponsUsedUpdateManySchema } from '../schemas/updateManyCuponsUsed.schema';
import { CuponsUsedUpdateOneSchema } from '../schemas/updateOneCuponsUsed.schema';
import { CuponsUsedUpsertSchema } from '../schemas/upsertOneCuponsUsed.schema';

export const cuponsusedsRouter = router({
  aggregateCuponsUsed: shieldedProcedure
    .input(CuponsUsedAggregateSchema)
    .query(async ({ ctx, input }) => {
      const aggregateCuponsUsed = await ctx.prisma.cuponsUsed.aggregate(input);
      return aggregateCuponsUsed;
    }),
  createManyCuponsUsed: shieldedProcedure
    .input(CuponsUsedCreateManySchema)
    .mutation(async ({ ctx, input }) => {
      const createManyCuponsUsed = await ctx.prisma.cuponsUsed.createMany(
        input,
      );
      return createManyCuponsUsed;
    }),
  createOneCuponsUsed: shieldedProcedure
    .input(CuponsUsedCreateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const createOneCuponsUsed = await ctx.prisma.cuponsUsed.create(input);
      return createOneCuponsUsed;
    }),
  deleteManyCuponsUsed: shieldedProcedure
    .input(CuponsUsedDeleteManySchema)
    .mutation(async ({ ctx, input }) => {
      const deleteManyCuponsUsed = await ctx.prisma.cuponsUsed.deleteMany(
        input,
      );
      return deleteManyCuponsUsed;
    }),
  deleteOneCuponsUsed: shieldedProcedure
    .input(CuponsUsedDeleteOneSchema)
    .mutation(async ({ ctx, input }) => {
      const deleteOneCuponsUsed = await ctx.prisma.cuponsUsed.delete(input);
      return deleteOneCuponsUsed;
    }),
  findFirstCuponsUsed: shieldedProcedure
    .input(CuponsUsedFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstCuponsUsed = await ctx.prisma.cuponsUsed.findFirst(input);
      return findFirstCuponsUsed;
    }),
  findFirstCuponsUsedOrThrow: shieldedProcedure
    .input(CuponsUsedFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstCuponsUsedOrThrow =
        await ctx.prisma.cuponsUsed.findFirstOrThrow(input);
      return findFirstCuponsUsedOrThrow;
    }),
  findManyCuponsUsed: shieldedProcedure
    .input(CuponsUsedFindManySchema)
    .query(async ({ ctx, input }) => {
      const findManyCuponsUsed = await ctx.prisma.cuponsUsed.findMany(input);
      return findManyCuponsUsed;
    }),
  findUniqueCuponsUsed: shieldedProcedure
    .input(CuponsUsedFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueCuponsUsed = await ctx.prisma.cuponsUsed.findUnique(
        input,
      );
      return findUniqueCuponsUsed;
    }),
  findUniqueCuponsUsedOrThrow: shieldedProcedure
    .input(CuponsUsedFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueCuponsUsedOrThrow =
        await ctx.prisma.cuponsUsed.findUniqueOrThrow(input);
      return findUniqueCuponsUsedOrThrow;
    }),
  groupByCuponsUsed: shieldedProcedure
    .input(CuponsUsedGroupBySchema)
    .query(async ({ ctx, input }) => {
      const groupByCuponsUsed = await ctx.prisma.cuponsUsed.groupBy({
        where: input.where,
        orderBy: input.orderBy,
        by: input.by,
        having: input.having,
        take: input.take,
        skip: input.skip,
      });
      return groupByCuponsUsed;
    }),
  updateManyCuponsUsed: shieldedProcedure
    .input(CuponsUsedUpdateManySchema)
    .mutation(async ({ ctx, input }) => {
      const updateManyCuponsUsed = await ctx.prisma.cuponsUsed.updateMany(
        input,
      );
      return updateManyCuponsUsed;
    }),
  updateOneCuponsUsed: shieldedProcedure
    .input(CuponsUsedUpdateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const updateOneCuponsUsed = await ctx.prisma.cuponsUsed.update(input);
      return updateOneCuponsUsed;
    }),
  upsertOneCuponsUsed: shieldedProcedure
    .input(CuponsUsedUpsertSchema)
    .mutation(async ({ ctx, input }) => {
      const upsertOneCuponsUsed = await ctx.prisma.cuponsUsed.upsert(input);
      return upsertOneCuponsUsed;
    }),
});
