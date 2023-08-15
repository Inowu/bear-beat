import { t, publicProcedure } from "./helpers/createRouter";
import { PlansAggregateSchema } from "../schemas/aggregatePlans.schema";
import { PlansCreateManySchema } from "../schemas/createManyPlans.schema";
import { PlansCreateOneSchema } from "../schemas/createOnePlans.schema";
import { PlansDeleteManySchema } from "../schemas/deleteManyPlans.schema";
import { PlansDeleteOneSchema } from "../schemas/deleteOnePlans.schema";
import { PlansFindFirstSchema } from "../schemas/findFirstPlans.schema";
import { PlansFindManySchema } from "../schemas/findManyPlans.schema";
import { PlansFindUniqueSchema } from "../schemas/findUniquePlans.schema";
import { PlansGroupBySchema } from "../schemas/groupByPlans.schema";
import { PlansUpdateManySchema } from "../schemas/updateManyPlans.schema";
import { PlansUpdateOneSchema } from "../schemas/updateOnePlans.schema";
import { PlansUpsertSchema } from "../schemas/upsertOnePlans.schema";

export const plansRouter = t.router({
  aggregatePlans: publicProcedure
    .input(PlansAggregateSchema).query(async ({ ctx, input }) => {
      const aggregatePlans = await ctx.prisma.plans.aggregate(input);
      return aggregatePlans;
    }),
  createManyPlans: publicProcedure
    .input(PlansCreateManySchema).mutation(async ({ ctx, input }) => {
      const createManyPlans = await ctx.prisma.plans.createMany(input);
      return createManyPlans;
    }),
  createOnePlans: publicProcedure
    .input(PlansCreateOneSchema).mutation(async ({ ctx, input }) => {
      const createOnePlans = await ctx.prisma.plans.create(input);
      return createOnePlans;
    }),
  deleteManyPlans: publicProcedure
    .input(PlansDeleteManySchema).mutation(async ({ ctx, input }) => {
      const deleteManyPlans = await ctx.prisma.plans.deleteMany(input);
      return deleteManyPlans;
    }),
  deleteOnePlans: publicProcedure
    .input(PlansDeleteOneSchema).mutation(async ({ ctx, input }) => {
      const deleteOnePlans = await ctx.prisma.plans.delete(input);
      return deleteOnePlans;
    }),
  findFirstPlans: publicProcedure
    .input(PlansFindFirstSchema).query(async ({ ctx, input }) => {
      const findFirstPlans = await ctx.prisma.plans.findFirst(input);
      return findFirstPlans;
    }),
  findFirstPlansOrThrow: publicProcedure
    .input(PlansFindFirstSchema).query(async ({ ctx, input }) => {
      const findFirstPlansOrThrow = await ctx.prisma.plans.findFirstOrThrow(input);
      return findFirstPlansOrThrow;
    }),
  findManyPlans: publicProcedure
    .input(PlansFindManySchema).query(async ({ ctx, input }) => {
      const findManyPlans = await ctx.prisma.plans.findMany(input);
      return findManyPlans;
    }),
  findUniquePlans: publicProcedure
    .input(PlansFindUniqueSchema).query(async ({ ctx, input }) => {
      const findUniquePlans = await ctx.prisma.plans.findUnique(input);
      return findUniquePlans;
    }),
  findUniquePlansOrThrow: publicProcedure
    .input(PlansFindUniqueSchema).query(async ({ ctx, input }) => {
      const findUniquePlansOrThrow = await ctx.prisma.plans.findUniqueOrThrow(input);
      return findUniquePlansOrThrow;
    }),
  groupByPlans: publicProcedure
    .input(PlansGroupBySchema).query(async ({ ctx, input }) => {
      const groupByPlans = await ctx.prisma.plans.groupBy({ where: input.where, orderBy: input.orderBy, by: input.by, having: input.having, take: input.take, skip: input.skip });
      return groupByPlans;
    }),
  updateManyPlans: publicProcedure
    .input(PlansUpdateManySchema).mutation(async ({ ctx, input }) => {
      const updateManyPlans = await ctx.prisma.plans.updateMany(input);
      return updateManyPlans;
    }),
  updateOnePlans: publicProcedure
    .input(PlansUpdateOneSchema).mutation(async ({ ctx, input }) => {
      const updateOnePlans = await ctx.prisma.plans.update(input);
      return updateOnePlans;
    }),
  upsertOnePlans: publicProcedure
    .input(PlansUpsertSchema).mutation(async ({ ctx, input }) => {
      const upsertOnePlans = await ctx.prisma.plans.upsert(input);
      return upsertOnePlans;
    }),

}) 
