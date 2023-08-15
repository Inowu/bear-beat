import { t, publicProcedure } from "./helpers/createRouter";
import { FtpUserAggregateSchema } from "../schemas/aggregateFtpUser.schema";
import { FtpUserCreateManySchema } from "../schemas/createManyFtpUser.schema";
import { FtpUserCreateOneSchema } from "../schemas/createOneFtpUser.schema";
import { FtpUserDeleteManySchema } from "../schemas/deleteManyFtpUser.schema";
import { FtpUserDeleteOneSchema } from "../schemas/deleteOneFtpUser.schema";
import { FtpUserFindFirstSchema } from "../schemas/findFirstFtpUser.schema";
import { FtpUserFindManySchema } from "../schemas/findManyFtpUser.schema";
import { FtpUserFindUniqueSchema } from "../schemas/findUniqueFtpUser.schema";
import { FtpUserGroupBySchema } from "../schemas/groupByFtpUser.schema";
import { FtpUserUpdateManySchema } from "../schemas/updateManyFtpUser.schema";
import { FtpUserUpdateOneSchema } from "../schemas/updateOneFtpUser.schema";
import { FtpUserUpsertSchema } from "../schemas/upsertOneFtpUser.schema";

export const ftpusersRouter = t.router({
  aggregateFtpUser: publicProcedure
    .input(FtpUserAggregateSchema).query(async ({ ctx, input }) => {
      const aggregateFtpUser = await ctx.prisma.ftpUser.aggregate(input);
      return aggregateFtpUser;
    }),
  createManyFtpUser: publicProcedure
    .input(FtpUserCreateManySchema).mutation(async ({ ctx, input }) => {
      const createManyFtpUser = await ctx.prisma.ftpUser.createMany(input);
      return createManyFtpUser;
    }),
  createOneFtpUser: publicProcedure
    .input(FtpUserCreateOneSchema).mutation(async ({ ctx, input }) => {
      const createOneFtpUser = await ctx.prisma.ftpUser.create(input);
      return createOneFtpUser;
    }),
  deleteManyFtpUser: publicProcedure
    .input(FtpUserDeleteManySchema).mutation(async ({ ctx, input }) => {
      const deleteManyFtpUser = await ctx.prisma.ftpUser.deleteMany(input);
      return deleteManyFtpUser;
    }),
  deleteOneFtpUser: publicProcedure
    .input(FtpUserDeleteOneSchema).mutation(async ({ ctx, input }) => {
      const deleteOneFtpUser = await ctx.prisma.ftpUser.delete(input);
      return deleteOneFtpUser;
    }),
  findFirstFtpUser: publicProcedure
    .input(FtpUserFindFirstSchema).query(async ({ ctx, input }) => {
      const findFirstFtpUser = await ctx.prisma.ftpUser.findFirst(input);
      return findFirstFtpUser;
    }),
  findFirstFtpUserOrThrow: publicProcedure
    .input(FtpUserFindFirstSchema).query(async ({ ctx, input }) => {
      const findFirstFtpUserOrThrow = await ctx.prisma.ftpUser.findFirstOrThrow(input);
      return findFirstFtpUserOrThrow;
    }),
  findManyFtpUser: publicProcedure
    .input(FtpUserFindManySchema).query(async ({ ctx, input }) => {
      const findManyFtpUser = await ctx.prisma.ftpUser.findMany(input);
      return findManyFtpUser;
    }),
  findUniqueFtpUser: publicProcedure
    .input(FtpUserFindUniqueSchema).query(async ({ ctx, input }) => {
      const findUniqueFtpUser = await ctx.prisma.ftpUser.findUnique(input);
      return findUniqueFtpUser;
    }),
  findUniqueFtpUserOrThrow: publicProcedure
    .input(FtpUserFindUniqueSchema).query(async ({ ctx, input }) => {
      const findUniqueFtpUserOrThrow = await ctx.prisma.ftpUser.findUniqueOrThrow(input);
      return findUniqueFtpUserOrThrow;
    }),
  groupByFtpUser: publicProcedure
    .input(FtpUserGroupBySchema).query(async ({ ctx, input }) => {
      const groupByFtpUser = await ctx.prisma.ftpUser.groupBy({ where: input.where, orderBy: input.orderBy, by: input.by, having: input.having, take: input.take, skip: input.skip });
      return groupByFtpUser;
    }),
  updateManyFtpUser: publicProcedure
    .input(FtpUserUpdateManySchema).mutation(async ({ ctx, input }) => {
      const updateManyFtpUser = await ctx.prisma.ftpUser.updateMany(input);
      return updateManyFtpUser;
    }),
  updateOneFtpUser: publicProcedure
    .input(FtpUserUpdateOneSchema).mutation(async ({ ctx, input }) => {
      const updateOneFtpUser = await ctx.prisma.ftpUser.update(input);
      return updateOneFtpUser;
    }),
  upsertOneFtpUser: publicProcedure
    .input(FtpUserUpsertSchema).mutation(async ({ ctx, input }) => {
      const upsertOneFtpUser = await ctx.prisma.ftpUser.upsert(input);
      return upsertOneFtpUser;
    }),

}) 
