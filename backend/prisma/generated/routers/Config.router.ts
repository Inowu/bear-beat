import { t, publicProcedure } from "./helpers/createRouter";
import { ConfigAggregateSchema } from "../schemas/aggregateConfig.schema";
import { ConfigCreateManySchema } from "../schemas/createManyConfig.schema";
import { ConfigCreateOneSchema } from "../schemas/createOneConfig.schema";
import { ConfigDeleteManySchema } from "../schemas/deleteManyConfig.schema";
import { ConfigDeleteOneSchema } from "../schemas/deleteOneConfig.schema";
import { ConfigFindFirstSchema } from "../schemas/findFirstConfig.schema";
import { ConfigFindManySchema } from "../schemas/findManyConfig.schema";
import { ConfigFindUniqueSchema } from "../schemas/findUniqueConfig.schema";
import { ConfigGroupBySchema } from "../schemas/groupByConfig.schema";
import { ConfigUpdateManySchema } from "../schemas/updateManyConfig.schema";
import { ConfigUpdateOneSchema } from "../schemas/updateOneConfig.schema";
import { ConfigUpsertSchema } from "../schemas/upsertOneConfig.schema";

export const configsRouter = t.router({
  aggregateConfig: publicProcedure
    .input(ConfigAggregateSchema).query(async ({ ctx, input }) => {
      const aggregateConfig = await ctx.prisma.config.aggregate(input);
      return aggregateConfig;
    }),
  createManyConfig: publicProcedure
    .input(ConfigCreateManySchema).mutation(async ({ ctx, input }) => {
      const createManyConfig = await ctx.prisma.config.createMany(input);
      return createManyConfig;
    }),
  createOneConfig: publicProcedure
    .input(ConfigCreateOneSchema).mutation(async ({ ctx, input }) => {
      const createOneConfig = await ctx.prisma.config.create(input);
      return createOneConfig;
    }),
  deleteManyConfig: publicProcedure
    .input(ConfigDeleteManySchema).mutation(async ({ ctx, input }) => {
      const deleteManyConfig = await ctx.prisma.config.deleteMany(input);
      return deleteManyConfig;
    }),
  deleteOneConfig: publicProcedure
    .input(ConfigDeleteOneSchema).mutation(async ({ ctx, input }) => {
      const deleteOneConfig = await ctx.prisma.config.delete(input);
      return deleteOneConfig;
    }),
  findFirstConfig: publicProcedure
    .input(ConfigFindFirstSchema).query(async ({ ctx, input }) => {
      const findFirstConfig = await ctx.prisma.config.findFirst(input);
      return findFirstConfig;
    }),
  findFirstConfigOrThrow: publicProcedure
    .input(ConfigFindFirstSchema).query(async ({ ctx, input }) => {
      const findFirstConfigOrThrow = await ctx.prisma.config.findFirstOrThrow(input);
      return findFirstConfigOrThrow;
    }),
  findManyConfig: publicProcedure
    .input(ConfigFindManySchema).query(async ({ ctx, input }) => {
      const findManyConfig = await ctx.prisma.config.findMany(input);
      return findManyConfig;
    }),
  findUniqueConfig: publicProcedure
    .input(ConfigFindUniqueSchema).query(async ({ ctx, input }) => {
      const findUniqueConfig = await ctx.prisma.config.findUnique(input);
      return findUniqueConfig;
    }),
  findUniqueConfigOrThrow: publicProcedure
    .input(ConfigFindUniqueSchema).query(async ({ ctx, input }) => {
      const findUniqueConfigOrThrow = await ctx.prisma.config.findUniqueOrThrow(input);
      return findUniqueConfigOrThrow;
    }),
  groupByConfig: publicProcedure
    .input(ConfigGroupBySchema).query(async ({ ctx, input }) => {
      const groupByConfig = await ctx.prisma.config.groupBy({ where: input.where, orderBy: input.orderBy, by: input.by, having: input.having, take: input.take, skip: input.skip });
      return groupByConfig;
    }),
  updateManyConfig: publicProcedure
    .input(ConfigUpdateManySchema).mutation(async ({ ctx, input }) => {
      const updateManyConfig = await ctx.prisma.config.updateMany(input);
      return updateManyConfig;
    }),
  updateOneConfig: publicProcedure
    .input(ConfigUpdateOneSchema).mutation(async ({ ctx, input }) => {
      const updateOneConfig = await ctx.prisma.config.update(input);
      return updateOneConfig;
    }),
  upsertOneConfig: publicProcedure
    .input(ConfigUpsertSchema).mutation(async ({ ctx, input }) => {
      const upsertOneConfig = await ctx.prisma.config.upsert(input);
      return upsertOneConfig;
    }),

}) 
