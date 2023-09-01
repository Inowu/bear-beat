import { shieldedProcedure } from '../procedures/shielded.procedure';
import { router } from '../trpc';
import { ConfigAggregateSchema } from '../schemas/aggregateConfig.schema';
import { ConfigCreateManySchema } from '../schemas/createManyConfig.schema';
import { ConfigCreateOneSchema } from '../schemas/createOneConfig.schema';
import { ConfigDeleteManySchema } from '../schemas/deleteManyConfig.schema';
import { ConfigDeleteOneSchema } from '../schemas/deleteOneConfig.schema';
import { ConfigFindFirstSchema } from '../schemas/findFirstConfig.schema';
import { ConfigFindManySchema } from '../schemas/findManyConfig.schema';
import { ConfigFindUniqueSchema } from '../schemas/findUniqueConfig.schema';
import { ConfigGroupBySchema } from '../schemas/groupByConfig.schema';
import { ConfigUpdateManySchema } from '../schemas/updateManyConfig.schema';
import { ConfigUpdateOneSchema } from '../schemas/updateOneConfig.schema';
import { ConfigUpsertSchema } from '../schemas/upsertOneConfig.schema';

export const configsRouter = router({
  aggregateConfig: shieldedProcedure
    .input(ConfigAggregateSchema)
    .query(async ({ ctx, input }) => {
      const aggregateConfig = await ctx.prisma.config.aggregate(input);
      return aggregateConfig;
    }),
  createManyConfig: shieldedProcedure
    .input(ConfigCreateManySchema)
    .mutation(async ({ ctx, input }) => {
      const createManyConfig = await ctx.prisma.config.createMany(input);
      return createManyConfig;
    }),
  createOneConfig: shieldedProcedure
    .input(ConfigCreateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const createOneConfig = await ctx.prisma.config.create(input);
      return createOneConfig;
    }),
  deleteManyConfig: shieldedProcedure
    .input(ConfigDeleteManySchema)
    .mutation(async ({ ctx, input }) => {
      const deleteManyConfig = await ctx.prisma.config.deleteMany(input);
      return deleteManyConfig;
    }),
  deleteOneConfig: shieldedProcedure
    .input(ConfigDeleteOneSchema)
    .mutation(async ({ ctx, input }) => {
      const deleteOneConfig = await ctx.prisma.config.delete(input);
      return deleteOneConfig;
    }),
  findFirstConfig: shieldedProcedure
    .input(ConfigFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstConfig = await ctx.prisma.config.findFirst(input);
      return findFirstConfig;
    }),
  findFirstConfigOrThrow: shieldedProcedure
    .input(ConfigFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstConfigOrThrow = await ctx.prisma.config.findFirstOrThrow(
        input,
      );
      return findFirstConfigOrThrow;
    }),
  findManyConfig: shieldedProcedure
    .input(ConfigFindManySchema)
    .query(async ({ ctx, input }) => {
      const findManyConfig = await ctx.prisma.config.findMany(input);
      return findManyConfig;
    }),
  findUniqueConfig: shieldedProcedure
    .input(ConfigFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueConfig = await ctx.prisma.config.findUnique(input);
      return findUniqueConfig;
    }),
  findUniqueConfigOrThrow: shieldedProcedure
    .input(ConfigFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueConfigOrThrow = await ctx.prisma.config.findUniqueOrThrow(
        input,
      );
      return findUniqueConfigOrThrow;
    }),
  groupByConfig: shieldedProcedure
    .input(ConfigGroupBySchema)
    .query(async ({ ctx, input }) => {
      const groupByConfig = await ctx.prisma.config.groupBy({
        where: input.where,
        orderBy: input.orderBy,
        by: input.by,
        having: input.having,
        take: input.take,
        skip: input.skip,
      });
      return groupByConfig;
    }),
  updateManyConfig: shieldedProcedure
    .input(ConfigUpdateManySchema)
    .mutation(async ({ ctx, input }) => {
      const updateManyConfig = await ctx.prisma.config.updateMany(input);
      return updateManyConfig;
    }),
  updateOneConfig: shieldedProcedure
    .input(ConfigUpdateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const updateOneConfig = await ctx.prisma.config.update(input);
      return updateOneConfig;
    }),
  upsertOneConfig: shieldedProcedure
    .input(ConfigUpsertSchema)
    .mutation(async ({ ctx, input }) => {
      const upsertOneConfig = await ctx.prisma.config.upsert(input);
      return upsertOneConfig;
    }),
});
