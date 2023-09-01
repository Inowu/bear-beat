import { shieldedProcedure } from '../procedures/shielded.procedure';
import { router } from '../trpc';
import { DescargasUserAggregateSchema } from '../schemas/aggregateDescargasUser.schema';
import { DescargasUserCreateManySchema } from '../schemas/createManyDescargasUser.schema';
import { DescargasUserCreateOneSchema } from '../schemas/createOneDescargasUser.schema';
import { DescargasUserDeleteManySchema } from '../schemas/deleteManyDescargasUser.schema';
import { DescargasUserDeleteOneSchema } from '../schemas/deleteOneDescargasUser.schema';
import { DescargasUserFindFirstSchema } from '../schemas/findFirstDescargasUser.schema';
import { DescargasUserFindManySchema } from '../schemas/findManyDescargasUser.schema';
import { DescargasUserFindUniqueSchema } from '../schemas/findUniqueDescargasUser.schema';
import { DescargasUserGroupBySchema } from '../schemas/groupByDescargasUser.schema';
import { DescargasUserUpdateManySchema } from '../schemas/updateManyDescargasUser.schema';
import { DescargasUserUpdateOneSchema } from '../schemas/updateOneDescargasUser.schema';
import { DescargasUserUpsertSchema } from '../schemas/upsertOneDescargasUser.schema';

export const descargasusersRouter = router({
  aggregateDescargasUser: shieldedProcedure
    .input(DescargasUserAggregateSchema)
    .query(async ({ ctx, input }) => {
      const aggregateDescargasUser = await ctx.prisma.descargasUser.aggregate(
        input,
      );
      return aggregateDescargasUser;
    }),
  createManyDescargasUser: shieldedProcedure
    .input(DescargasUserCreateManySchema)
    .mutation(async ({ ctx, input }) => {
      const createManyDescargasUser = await ctx.prisma.descargasUser.createMany(
        input,
      );
      return createManyDescargasUser;
    }),
  createOneDescargasUser: shieldedProcedure
    .input(DescargasUserCreateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const createOneDescargasUser = await ctx.prisma.descargasUser.create(
        input,
      );
      return createOneDescargasUser;
    }),
  deleteManyDescargasUser: shieldedProcedure
    .input(DescargasUserDeleteManySchema)
    .mutation(async ({ ctx, input }) => {
      const deleteManyDescargasUser = await ctx.prisma.descargasUser.deleteMany(
        input,
      );
      return deleteManyDescargasUser;
    }),
  deleteOneDescargasUser: shieldedProcedure
    .input(DescargasUserDeleteOneSchema)
    .mutation(async ({ ctx, input }) => {
      const deleteOneDescargasUser = await ctx.prisma.descargasUser.delete(
        input,
      );
      return deleteOneDescargasUser;
    }),
  findFirstDescargasUser: shieldedProcedure
    .input(DescargasUserFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstDescargasUser = await ctx.prisma.descargasUser.findFirst(
        input,
      );
      return findFirstDescargasUser;
    }),
  findFirstDescargasUserOrThrow: shieldedProcedure
    .input(DescargasUserFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstDescargasUserOrThrow =
        await ctx.prisma.descargasUser.findFirstOrThrow(input);
      return findFirstDescargasUserOrThrow;
    }),
  findManyDescargasUser: shieldedProcedure
    .input(DescargasUserFindManySchema)
    .query(async ({ ctx, input }) => {
      const findManyDescargasUser = await ctx.prisma.descargasUser.findMany(
        input,
      );
      return findManyDescargasUser;
    }),
  findUniqueDescargasUser: shieldedProcedure
    .input(DescargasUserFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueDescargasUser = await ctx.prisma.descargasUser.findUnique(
        input,
      );
      return findUniqueDescargasUser;
    }),
  findUniqueDescargasUserOrThrow: shieldedProcedure
    .input(DescargasUserFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueDescargasUserOrThrow =
        await ctx.prisma.descargasUser.findUniqueOrThrow(input);
      return findUniqueDescargasUserOrThrow;
    }),
  groupByDescargasUser: shieldedProcedure
    .input(DescargasUserGroupBySchema)
    .query(async ({ ctx, input }) => {
      const groupByDescargasUser = await ctx.prisma.descargasUser.groupBy({
        where: input.where,
        orderBy: input.orderBy,
        by: input.by,
        having: input.having,
        take: input.take,
        skip: input.skip,
      });
      return groupByDescargasUser;
    }),
  updateManyDescargasUser: shieldedProcedure
    .input(DescargasUserUpdateManySchema)
    .mutation(async ({ ctx, input }) => {
      const updateManyDescargasUser = await ctx.prisma.descargasUser.updateMany(
        input,
      );
      return updateManyDescargasUser;
    }),
  updateOneDescargasUser: shieldedProcedure
    .input(DescargasUserUpdateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const updateOneDescargasUser = await ctx.prisma.descargasUser.update(
        input,
      );
      return updateOneDescargasUser;
    }),
  upsertOneDescargasUser: shieldedProcedure
    .input(DescargasUserUpsertSchema)
    .mutation(async ({ ctx, input }) => {
      const upsertOneDescargasUser = await ctx.prisma.descargasUser.upsert(
        input,
      );
      return upsertOneDescargasUser;
    }),
});
