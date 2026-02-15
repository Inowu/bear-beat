import { extendedAccountPostfix } from '../utils/constants';
import { FtpQuotaLimitsAggregateSchema } from '../schemas/aggregateFtpQuotaLimits.schema';
import { FtpQuotaLimitsCreateManySchema } from '../schemas/createManyFtpQuotaLimits.schema';
import { FtpQuotaLimitsCreateOneSchema } from '../schemas/createOneFtpQuotaLimits.schema';
import { FtpQuotaLimitsDeleteManySchema } from '../schemas/deleteManyFtpQuotaLimits.schema';
import { FtpQuotaLimitsDeleteOneSchema } from '../schemas/deleteOneFtpQuotaLimits.schema';
import { FtpQuotaLimitsFindFirstSchema } from '../schemas/findFirstFtpQuotaLimits.schema';
import { FtpQuotaLimitsFindManySchema } from '../schemas/findManyFtpQuotaLimits.schema';
import { FtpQuotaLimitsFindUniqueSchema } from '../schemas/findUniqueFtpQuotaLimits.schema';
import { FtpQuotaLimitsGroupBySchema } from '../schemas/groupByFtpQuotaLimits.schema';
import { FtpQuotaLimitsUpdateManySchema } from '../schemas/updateManyFtpQuotaLimits.schema';
import { FtpQuotaLimitsUpdateOneSchema } from '../schemas/updateOneFtpQuotaLimits.schema';
import { FtpQuotaLimitsUpsertSchema } from '../schemas/upsertOneFtpQuotaLimits.schema';
import { gbToBytes } from '../utils/gbToBytes';
import { log } from '../server';
import { router } from '../trpc';
import { shieldedProcedure } from '../procedures/shielded.procedure';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';

export const ftpquotalimitsRouter = router({
  aggregateFtpQuotaLimits: shieldedProcedure
    .input(FtpQuotaLimitsAggregateSchema)
    .query(async ({ ctx, input }) => {
      const aggregateFtpQuotaLimits = await ctx.prisma.ftpQuotaLimits.aggregate(
        input,
      );
      return aggregateFtpQuotaLimits;
    }),
  createManyFtpQuotaLimits: shieldedProcedure
    .input(FtpQuotaLimitsCreateManySchema)
    .mutation(async ({ ctx, input }) => {
      const createManyFtpQuotaLimits =
        await ctx.prisma.ftpQuotaLimits.createMany(input);
      return createManyFtpQuotaLimits;
    }),
  createOneFtpQuotaLimits: shieldedProcedure
    .input(FtpQuotaLimitsCreateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const createOneFtpQuotaLimits = await ctx.prisma.ftpQuotaLimits.create(
        input,
      );
      return createOneFtpQuotaLimits;
    }),
  deleteManyFtpQuotaLimits: shieldedProcedure
    .input(FtpQuotaLimitsDeleteManySchema)
    .mutation(async ({ ctx, input }) => {
      const deleteManyFtpQuotaLimits =
        await ctx.prisma.ftpQuotaLimits.deleteMany(input);
      return deleteManyFtpQuotaLimits;
    }),
  deleteOneFtpQuotaLimits: shieldedProcedure
    .input(FtpQuotaLimitsDeleteOneSchema)
    .mutation(async ({ ctx, input }) => {
      const deleteOneFtpQuotaLimits = await ctx.prisma.ftpQuotaLimits.delete(
        input,
      );
      return deleteOneFtpQuotaLimits;
    }),
  findFirstFtpQuotaLimits: shieldedProcedure
    .input(FtpQuotaLimitsFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstFtpQuotaLimits = await ctx.prisma.ftpQuotaLimits.findFirst(
        input,
      );
      return findFirstFtpQuotaLimits;
    }),
  findFirstFtpQuotaLimitsOrThrow: shieldedProcedure
    .input(FtpQuotaLimitsFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstFtpQuotaLimitsOrThrow =
        await ctx.prisma.ftpQuotaLimits.findFirstOrThrow(input);
      return findFirstFtpQuotaLimitsOrThrow;
    }),
  findManyFtpQuotaLimits: shieldedProcedure
    .input(FtpQuotaLimitsFindManySchema)
    .query(async ({ ctx, input }) => {
      const findManyFtpQuotaLimits = await ctx.prisma.ftpQuotaLimits.findMany(
        input,
      );
      return findManyFtpQuotaLimits;
    }),
  findUniqueFtpQuotaLimits: shieldedProcedure
    .input(FtpQuotaLimitsFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueFtpQuotaLimits =
        await ctx.prisma.ftpQuotaLimits.findUnique(input);
      return findUniqueFtpQuotaLimits;
    }),
  findUniqueFtpQuotaLimitsOrThrow: shieldedProcedure
    .input(FtpQuotaLimitsFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueFtpQuotaLimitsOrThrow =
        await ctx.prisma.ftpQuotaLimits.findUniqueOrThrow(input);
      return findUniqueFtpQuotaLimitsOrThrow;
    }),
  groupByFtpQuotaLimits: shieldedProcedure
    .input(FtpQuotaLimitsGroupBySchema)
    .query(async ({ ctx, input }) => {
      const groupByFtpQuotaLimits = await ctx.prisma.ftpQuotaLimits.groupBy({
        where: input.where,
        orderBy: input.orderBy,
        by: input.by,
        having: input.having,
        take: input.take,
        skip: input.skip,
      });
      return groupByFtpQuotaLimits;
    }),
  updateManyFtpQuotaLimits: shieldedProcedure
    .input(FtpQuotaLimitsUpdateManySchema)
    .mutation(async ({ ctx, input }) => {
      const updateManyFtpQuotaLimits =
        await ctx.prisma.ftpQuotaLimits.updateMany(input);
      return updateManyFtpQuotaLimits;
    }),
  updateOneFtpQuotaLimits: shieldedProcedure
    .input(FtpQuotaLimitsUpdateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const updateOneFtpQuotaLimits = await ctx.prisma.ftpQuotaLimits.update(
        input,
      );
      return updateOneFtpQuotaLimits;
    }),
  upsertOneFtpQuotaLimits: shieldedProcedure
    .input(FtpQuotaLimitsUpsertSchema)
    .mutation(async ({ ctx, input }) => {
      const upsertOneFtpQuotaLimits = await ctx.prisma.ftpQuotaLimits.upsert(
        input,
      );
      return upsertOneFtpQuotaLimits;
    }),
  findManyFtpQuotaLimitsByUser: shieldedProcedure
    .input(
      z.object({
        userId: z.number(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const { userId } = input;

      const ftpAccounts = await ctx.prisma.ftpUser.findMany({
        where: {
          user_id: userId,
        },
      });

      let regularFtpUser = ftpAccounts.find(
        (ftpAccount) => !ftpAccount.userid.endsWith(extendedAccountPostfix),
      );

      let useExtendedAccount = false;

      if (ftpAccounts.length === 0 || !regularFtpUser) {
        log.error('[GET_QUOTA_LIMITS] User does not have an ftp user');

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Este usuario no tiene una cuenta FTP',
        });
      }

      const extendedAccount = ftpAccounts.find((ftpAccount) =>
        ftpAccount.userid.endsWith(extendedAccountPostfix),
      );

      const quotaLimits = await ctx.prisma.ftpQuotaLimits.findFirst({
        where: {
          name: regularFtpUser.userid,
        },
        orderBy: {
          id: 'desc'
        }
      });

      if (!quotaLimits) {
        log.error(
          '[GET_QUOTA_LIMITS] User does not have quotas',
        );

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No hay quotas activas para este usuario',
        });
      }

      return quotaLimits;
    }),
  addAdditionalGBToQuotaLimit: shieldedProcedure
    .input(
      z.object({
        gigas: z.number(),
        quotaId: z.number(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const updateOneFtpQuotaLimits = await ctx.prisma.ftpQuotaLimits.update(
        {
          where: {
            id: input.quotaId
          },
          data: {
            bytes_out_avail: gbToBytes(input.gigas),
          }
        }
      );
      return updateOneFtpQuotaLimits;
    }),
});
