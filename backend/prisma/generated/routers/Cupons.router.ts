import { t, publicProcedure } from "./helpers/createRouter";
import { CuponsAggregateSchema } from "../schemas/aggregateCupons.schema";
import { CuponsCreateManySchema } from "../schemas/createManyCupons.schema";
import { CuponsCreateOneSchema } from "../schemas/createOneCupons.schema";
import { CuponsDeleteManySchema } from "../schemas/deleteManyCupons.schema";
import { CuponsDeleteOneSchema } from "../schemas/deleteOneCupons.schema";
import { CuponsFindFirstSchema } from "../schemas/findFirstCupons.schema";
import { CuponsFindManySchema } from "../schemas/findManyCupons.schema";
import { CuponsFindUniqueSchema } from "../schemas/findUniqueCupons.schema";
import { CuponsGroupBySchema } from "../schemas/groupByCupons.schema";
import { CuponsUpdateManySchema } from "../schemas/updateManyCupons.schema";
import { CuponsUpdateOneSchema } from "../schemas/updateOneCupons.schema";
import { CuponsUpsertSchema } from "../schemas/upsertOneCupons.schema";

export const cuponsRouter = t.router({
  aggregateCupons: publicProcedure
    .input(CuponsAggregateSchema).query(async ({ ctx, input }) => {
      const aggregateCupons = await ctx.prisma.cupons.aggregate(input);
      return aggregateCupons;
    }),
  createManyCupons: publicProcedure
    .input(CuponsCreateManySchema).mutation(async ({ ctx, input }) => {
      const createManyCupons = await ctx.prisma.cupons.createMany(input);
      return createManyCupons;
    }),
  createOneCupons: publicProcedure
    .input(CuponsCreateOneSchema).mutation(async ({ ctx, input }) => {
      const createOneCupons = await ctx.prisma.cupons.create(input);
      return createOneCupons;
    }),
  deleteManyCupons: publicProcedure
    .input(CuponsDeleteManySchema).mutation(async ({ ctx, input }) => {
      const deleteManyCupons = await ctx.prisma.cupons.deleteMany(input);
      return deleteManyCupons;
    }),
  deleteOneCupons: publicProcedure
    .input(CuponsDeleteOneSchema).mutation(async ({ ctx, input }) => {
      const deleteOneCupons = await ctx.prisma.cupons.delete(input);
      return deleteOneCupons;
    }),
  findFirstCupons: publicProcedure
    .input(CuponsFindFirstSchema).query(async ({ ctx, input }) => {
      const findFirstCupons = await ctx.prisma.cupons.findFirst(input);
      return findFirstCupons;
    }),
  findFirstCuponsOrThrow: publicProcedure
    .input(CuponsFindFirstSchema).query(async ({ ctx, input }) => {
      const findFirstCuponsOrThrow = await ctx.prisma.cupons.findFirstOrThrow(input);
      return findFirstCuponsOrThrow;
    }),
  findManyCupons: publicProcedure
    .input(CuponsFindManySchema).query(async ({ ctx, input }) => {
      const findManyCupons = await ctx.prisma.cupons.findMany(input);
      return findManyCupons;
    }),
  findUniqueCupons: publicProcedure
    .input(CuponsFindUniqueSchema).query(async ({ ctx, input }) => {
      const findUniqueCupons = await ctx.prisma.cupons.findUnique(input);
      return findUniqueCupons;
    }),
  findUniqueCuponsOrThrow: publicProcedure
    .input(CuponsFindUniqueSchema).query(async ({ ctx, input }) => {
      const findUniqueCuponsOrThrow = await ctx.prisma.cupons.findUniqueOrThrow(input);
      return findUniqueCuponsOrThrow;
    }),
  groupByCupons: publicProcedure
    .input(CuponsGroupBySchema).query(async ({ ctx, input }) => {
      const groupByCupons = await ctx.prisma.cupons.groupBy({ where: input.where, orderBy: input.orderBy, by: input.by, having: input.having, take: input.take, skip: input.skip });
      return groupByCupons;
    }),
  updateManyCupons: publicProcedure
    .input(CuponsUpdateManySchema).mutation(async ({ ctx, input }) => {
      const updateManyCupons = await ctx.prisma.cupons.updateMany(input);
      return updateManyCupons;
    }),
  updateOneCupons: publicProcedure
    .input(CuponsUpdateOneSchema).mutation(async ({ ctx, input }) => {
      const updateOneCupons = await ctx.prisma.cupons.update(input);
      return updateOneCupons;
    }),
  upsertOneCupons: publicProcedure
    .input(CuponsUpsertSchema).mutation(async ({ ctx, input }) => {
      const upsertOneCupons = await ctx.prisma.cupons.upsert(input);
      return upsertOneCupons;
    }),

}) 
