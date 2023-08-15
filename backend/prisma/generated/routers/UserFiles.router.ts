import { t, publicProcedure } from "./helpers/createRouter";
import { UserFilesAggregateSchema } from "../schemas/aggregateUserFiles.schema";
import { UserFilesCreateManySchema } from "../schemas/createManyUserFiles.schema";
import { UserFilesCreateOneSchema } from "../schemas/createOneUserFiles.schema";
import { UserFilesDeleteManySchema } from "../schemas/deleteManyUserFiles.schema";
import { UserFilesDeleteOneSchema } from "../schemas/deleteOneUserFiles.schema";
import { UserFilesFindFirstSchema } from "../schemas/findFirstUserFiles.schema";
import { UserFilesFindManySchema } from "../schemas/findManyUserFiles.schema";
import { UserFilesFindUniqueSchema } from "../schemas/findUniqueUserFiles.schema";
import { UserFilesGroupBySchema } from "../schemas/groupByUserFiles.schema";
import { UserFilesUpdateManySchema } from "../schemas/updateManyUserFiles.schema";
import { UserFilesUpdateOneSchema } from "../schemas/updateOneUserFiles.schema";
import { UserFilesUpsertSchema } from "../schemas/upsertOneUserFiles.schema";

export const userfilesRouter = t.router({
  aggregateUserFiles: publicProcedure
    .input(UserFilesAggregateSchema).query(async ({ ctx, input }) => {
      const aggregateUserFiles = await ctx.prisma.userFiles.aggregate(input);
      return aggregateUserFiles;
    }),
  createManyUserFiles: publicProcedure
    .input(UserFilesCreateManySchema).mutation(async ({ ctx, input }) => {
      const createManyUserFiles = await ctx.prisma.userFiles.createMany(input);
      return createManyUserFiles;
    }),
  createOneUserFiles: publicProcedure
    .input(UserFilesCreateOneSchema).mutation(async ({ ctx, input }) => {
      const createOneUserFiles = await ctx.prisma.userFiles.create(input);
      return createOneUserFiles;
    }),
  deleteManyUserFiles: publicProcedure
    .input(UserFilesDeleteManySchema).mutation(async ({ ctx, input }) => {
      const deleteManyUserFiles = await ctx.prisma.userFiles.deleteMany(input);
      return deleteManyUserFiles;
    }),
  deleteOneUserFiles: publicProcedure
    .input(UserFilesDeleteOneSchema).mutation(async ({ ctx, input }) => {
      const deleteOneUserFiles = await ctx.prisma.userFiles.delete(input);
      return deleteOneUserFiles;
    }),
  findFirstUserFiles: publicProcedure
    .input(UserFilesFindFirstSchema).query(async ({ ctx, input }) => {
      const findFirstUserFiles = await ctx.prisma.userFiles.findFirst(input);
      return findFirstUserFiles;
    }),
  findFirstUserFilesOrThrow: publicProcedure
    .input(UserFilesFindFirstSchema).query(async ({ ctx, input }) => {
      const findFirstUserFilesOrThrow = await ctx.prisma.userFiles.findFirstOrThrow(input);
      return findFirstUserFilesOrThrow;
    }),
  findManyUserFiles: publicProcedure
    .input(UserFilesFindManySchema).query(async ({ ctx, input }) => {
      const findManyUserFiles = await ctx.prisma.userFiles.findMany(input);
      return findManyUserFiles;
    }),
  findUniqueUserFiles: publicProcedure
    .input(UserFilesFindUniqueSchema).query(async ({ ctx, input }) => {
      const findUniqueUserFiles = await ctx.prisma.userFiles.findUnique(input);
      return findUniqueUserFiles;
    }),
  findUniqueUserFilesOrThrow: publicProcedure
    .input(UserFilesFindUniqueSchema).query(async ({ ctx, input }) => {
      const findUniqueUserFilesOrThrow = await ctx.prisma.userFiles.findUniqueOrThrow(input);
      return findUniqueUserFilesOrThrow;
    }),
  groupByUserFiles: publicProcedure
    .input(UserFilesGroupBySchema).query(async ({ ctx, input }) => {
      const groupByUserFiles = await ctx.prisma.userFiles.groupBy({ where: input.where, orderBy: input.orderBy, by: input.by, having: input.having, take: input.take, skip: input.skip });
      return groupByUserFiles;
    }),
  updateManyUserFiles: publicProcedure
    .input(UserFilesUpdateManySchema).mutation(async ({ ctx, input }) => {
      const updateManyUserFiles = await ctx.prisma.userFiles.updateMany(input);
      return updateManyUserFiles;
    }),
  updateOneUserFiles: publicProcedure
    .input(UserFilesUpdateOneSchema).mutation(async ({ ctx, input }) => {
      const updateOneUserFiles = await ctx.prisma.userFiles.update(input);
      return updateOneUserFiles;
    }),
  upsertOneUserFiles: publicProcedure
    .input(UserFilesUpsertSchema).mutation(async ({ ctx, input }) => {
      const upsertOneUserFiles = await ctx.prisma.userFiles.upsert(input);
      return upsertOneUserFiles;
    }),

}) 
