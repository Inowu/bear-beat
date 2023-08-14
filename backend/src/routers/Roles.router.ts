import { shieldedProcedure } from "../procedures/shielded.procedure";
import { router } from "../trpc";
import { RolesAggregateSchema } from "../schemas/aggregateRoles.schema";
import { RolesCreateManySchema } from "../schemas/createManyRoles.schema";
import { RolesCreateOneSchema } from "../schemas/createOneRoles.schema";
import { RolesDeleteManySchema } from "../schemas/deleteManyRoles.schema";
import { RolesDeleteOneSchema } from "../schemas/deleteOneRoles.schema";
import { RolesFindFirstSchema } from "../schemas/findFirstRoles.schema";
import { RolesFindManySchema } from "../schemas/findManyRoles.schema";
import { RolesFindUniqueSchema } from "../schemas/findUniqueRoles.schema";
import { RolesGroupBySchema } from "../schemas/groupByRoles.schema";
import { RolesUpdateManySchema } from "../schemas/updateManyRoles.schema";
import { RolesUpdateOneSchema } from "../schemas/updateOneRoles.schema";
import { RolesUpsertSchema } from "../schemas/upsertOneRoles.schema";

export const rolesRouter = router({
  aggregateRoles: shieldedProcedure
    .input(RolesAggregateSchema)
    .query(async ({ ctx, input }) => {
      const aggregateRoles = await ctx.prisma.roles.aggregate(input);
      return aggregateRoles;
    }),
  createManyRoles: shieldedProcedure
    .input(RolesCreateManySchema)
    .mutation(async ({ ctx, input }) => {
      const createManyRoles = await ctx.prisma.roles.createMany(input);
      return createManyRoles;
    }),
  createOneRoles: shieldedProcedure
    .input(RolesCreateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const createOneRoles = await ctx.prisma.roles.create(input);
      return createOneRoles;
    }),
  deleteManyRoles: shieldedProcedure
    .input(RolesDeleteManySchema)
    .mutation(async ({ ctx, input }) => {
      const deleteManyRoles = await ctx.prisma.roles.deleteMany(input);
      return deleteManyRoles;
    }),
  deleteOneRoles: shieldedProcedure
    .input(RolesDeleteOneSchema)
    .mutation(async ({ ctx, input }) => {
      const deleteOneRoles = await ctx.prisma.roles.delete(input);
      return deleteOneRoles;
    }),
  findFirstRoles: shieldedProcedure
    .input(RolesFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstRoles = await ctx.prisma.roles.findFirst(input);
      return findFirstRoles;
    }),
  findFirstRolesOrThrow: shieldedProcedure
    .input(RolesFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstRolesOrThrow = await ctx.prisma.roles.findFirstOrThrow(
        input
      );
      return findFirstRolesOrThrow;
    }),
  findManyRoles: shieldedProcedure
    .input(RolesFindManySchema)
    .query(async ({ ctx, input }) => {
      const findManyRoles = await ctx.prisma.roles.findMany(input);
      return findManyRoles;
    }),
  findUniqueRoles: shieldedProcedure
    .input(RolesFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueRoles = await ctx.prisma.roles.findUnique(input);
      return findUniqueRoles;
    }),
  findUniqueRolesOrThrow: shieldedProcedure
    .input(RolesFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueRolesOrThrow = await ctx.prisma.roles.findUniqueOrThrow(
        input
      );
      return findUniqueRolesOrThrow;
    }),
  groupByRoles: shieldedProcedure
    .input(RolesGroupBySchema)
    .query(async ({ ctx, input }) => {
      const groupByRoles = await ctx.prisma.roles.groupBy({
        where: input.where,
        orderBy: input.orderBy,
        by: input.by,
        having: input.having,
        take: input.take,
        skip: input.skip,
      });
      return groupByRoles;
    }),
  updateManyRoles: shieldedProcedure
    .input(RolesUpdateManySchema)
    .mutation(async ({ ctx, input }) => {
      const updateManyRoles = await ctx.prisma.roles.updateMany(input);
      return updateManyRoles;
    }),
  updateOneRoles: shieldedProcedure
    .input(RolesUpdateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const updateOneRoles = await ctx.prisma.roles.update(input);
      return updateOneRoles;
    }),
  upsertOneRoles: shieldedProcedure
    .input(RolesUpsertSchema)
    .mutation(async ({ ctx, input }) => {
      const upsertOneRoles = await ctx.prisma.roles.upsert(input);
      return upsertOneRoles;
    }),
});
