import { shieldedProcedure } from '../procedures/shielded.procedure';
import { router } from '../trpc';
import { CountriesAggregateSchema } from '../schemas/aggregateCountries.schema';
import { CountriesCreateManySchema } from '../schemas/createManyCountries.schema';
import { CountriesCreateOneSchema } from '../schemas/createOneCountries.schema';
import { CountriesDeleteManySchema } from '../schemas/deleteManyCountries.schema';
import { CountriesDeleteOneSchema } from '../schemas/deleteOneCountries.schema';
import { CountriesFindFirstSchema } from '../schemas/findFirstCountries.schema';
import { CountriesFindManySchema } from '../schemas/findManyCountries.schema';
import { CountriesFindUniqueSchema } from '../schemas/findUniqueCountries.schema';
import { CountriesGroupBySchema } from '../schemas/groupByCountries.schema';
import { CountriesUpdateManySchema } from '../schemas/updateManyCountries.schema';
import { CountriesUpdateOneSchema } from '../schemas/updateOneCountries.schema';
import { CountriesUpsertSchema } from '../schemas/upsertOneCountries.schema';

export const countriesRouter = router({
  aggregateCountries: shieldedProcedure
    .input(CountriesAggregateSchema)
    .query(async ({ ctx, input }) => {
      const aggregateCountries = await ctx.prisma.countries.aggregate(input);
      return aggregateCountries;
    }),
  createManyCountries: shieldedProcedure
    .input(CountriesCreateManySchema)
    .mutation(async ({ ctx, input }) => {
      const createManyCountries = await ctx.prisma.countries.createMany(input);
      return createManyCountries;
    }),
  createOneCountries: shieldedProcedure
    .input(CountriesCreateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const createOneCountries = await ctx.prisma.countries.create(input);
      return createOneCountries;
    }),
  deleteManyCountries: shieldedProcedure
    .input(CountriesDeleteManySchema)
    .mutation(async ({ ctx, input }) => {
      const deleteManyCountries = await ctx.prisma.countries.deleteMany(input);
      return deleteManyCountries;
    }),
  deleteOneCountries: shieldedProcedure
    .input(CountriesDeleteOneSchema)
    .mutation(async ({ ctx, input }) => {
      const deleteOneCountries = await ctx.prisma.countries.delete(input);
      return deleteOneCountries;
    }),
  findFirstCountries: shieldedProcedure
    .input(CountriesFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstCountries = await ctx.prisma.countries.findFirst(input);
      return findFirstCountries;
    }),
  findFirstCountriesOrThrow: shieldedProcedure
    .input(CountriesFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstCountriesOrThrow =
        await ctx.prisma.countries.findFirstOrThrow(input);
      return findFirstCountriesOrThrow;
    }),
  findManyCountries: shieldedProcedure
    .input(CountriesFindManySchema)
    .query(async ({ ctx, input }) => {
      const findManyCountries = await ctx.prisma.countries.findMany(input);
      return findManyCountries;
    }),
  findUniqueCountries: shieldedProcedure
    .input(CountriesFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueCountries = await ctx.prisma.countries.findUnique(input);
      return findUniqueCountries;
    }),
  findUniqueCountriesOrThrow: shieldedProcedure
    .input(CountriesFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueCountriesOrThrow =
        await ctx.prisma.countries.findUniqueOrThrow(input);
      return findUniqueCountriesOrThrow;
    }),
  groupByCountries: shieldedProcedure
    .input(CountriesGroupBySchema)
    .query(async ({ ctx, input }) => {
      const groupByCountries = await ctx.prisma.countries.groupBy({
        where: input.where,
        orderBy: input.orderBy,
        by: input.by,
        having: input.having,
        take: input.take,
        skip: input.skip,
      });
      return groupByCountries;
    }),
  updateManyCountries: shieldedProcedure
    .input(CountriesUpdateManySchema)
    .mutation(async ({ ctx, input }) => {
      const updateManyCountries = await ctx.prisma.countries.updateMany(input);
      return updateManyCountries;
    }),
  updateOneCountries: shieldedProcedure
    .input(CountriesUpdateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const updateOneCountries = await ctx.prisma.countries.update(input);
      return updateOneCountries;
    }),
  upsertOneCountries: shieldedProcedure
    .input(CountriesUpsertSchema)
    .mutation(async ({ ctx, input }) => {
      const upsertOneCountries = await ctx.prisma.countries.upsert(input);
      return upsertOneCountries;
    }),
});
