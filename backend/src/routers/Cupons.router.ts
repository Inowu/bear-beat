import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../procedures/shielded.procedure';
import { router } from '../trpc';
import { CuponsAggregateSchema } from '../schemas/aggregateCupons.schema';
import { CuponsCreateManySchema } from '../schemas/createManyCupons.schema';
import { CuponsCreateOneSchema } from '../schemas/createOneCupons.schema';
import { CuponsDeleteManySchema } from '../schemas/deleteManyCupons.schema';
import { CuponsDeleteOneSchema } from '../schemas/deleteOneCupons.schema';
import { CuponsFindFirstSchema } from '../schemas/findFirstCupons.schema';
import { CuponsFindManySchema } from '../schemas/findManyCupons.schema';
import { CuponsFindUniqueSchema } from '../schemas/findUniqueCupons.schema';
import { CuponsGroupBySchema } from '../schemas/groupByCupons.schema';
import { CuponsUpdateManySchema } from '../schemas/updateManyCupons.schema';
import { CuponsUpdateOneSchema } from '../schemas/updateOneCupons.schema';
import { CuponsUpsertSchema } from '../schemas/upsertOneCupons.schema';
import stripeInstance from '../stripe';
import { log } from '../server';

export const cuponsRouter = router({
  /**
   * Returns the discount porcentaje of the coupon with the specified code
   * or throws a 404 error if no coupon with the specified code was found
   */
  findByCode: shieldedProcedure
    .input(
      z.object({
        code: z.string(),
      }),
    )
    .query(async ({ input: { code }, ctx: { prisma } }) => {
      const cupon = await prisma.cupons.findFirst({
        where: {
          AND: [
            {
              code,
            },
            {
              active: 1,
            },
          ],
        },
      });

      if (!cupon) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No coupon was found with the specified code',
        });
      }

      return {
        discount: cupon.discount,
      };
    }),
  createStripeCupon: shieldedProcedure
    .input(CuponsCreateOneSchema)
    .mutation(async ({ input, ctx: { prisma } }) => {
      try {
        stripeInstance.coupons.create({
          name: input.data.code,
          id: input.data.code,
          percent_off: input.data.discount,
        });

        await prisma.cupons.create(input);
      } catch (e: any) {
        log.error(`[COUPONS] Error creating coupon: ${e.message}`);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error al crear cupón',
        });
      }
    }),
  deleteStripeCupon: shieldedProcedure
    .input(
      z.object({
        code: z.string(),
      }),
    )
    .mutation(async ({ input: { code } }) => {
      try {
        const cupon = await stripeInstance.coupons.del(code);

        return {
          message: `Cupón ${cupon.id} fue eliminado`,
        };
      } catch (e: any) {
        log.error(`[COUPONS] Error deleting coupon: ${e.message}`);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error al eliminar cupón',
        });
      }
    }),
  updateStripeCupon: shieldedProcedure
    .input(CuponsUpdateOneSchema)
    .mutation(async ({ input, ctx: { prisma } }) => {
      if (input.data.code) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No se puede actualizar el código del cupón',
        });
      }

      if (input.data.discount) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'No se puede actualizar el descuento del cupón',
        });
      }

      try {
        await stripeInstance.coupons.update(input.data.code as string, {
          name: input.data.code as string,
        });

        await prisma.cupons.update({
          where: {
            code: input.data.code as string,
          },
          data: {
            description: input.data.description,
            active: input.data.active,
          },
        });
      } catch (e: any) {
        log.error(`[COUPONS] Error updating coupon: ${e.message}`);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error al actualizar cupón',
        });
      }
    }),
  aggregateCupons: shieldedProcedure
    .input(CuponsAggregateSchema)
    .query(async ({ ctx, input }) => {
      const aggregateCupons = await ctx.prisma.cupons.aggregate(input);
      return aggregateCupons;
    }),
  createManyCupons: shieldedProcedure
    .input(CuponsCreateManySchema)
    .mutation(async ({ ctx, input }) => {
      const createManyCupons = await ctx.prisma.cupons.createMany(input);
      return createManyCupons;
    }),
  createOneCupons: shieldedProcedure
    .input(CuponsCreateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const createOneCupons = await ctx.prisma.cupons.create(input);
      return createOneCupons;
    }),
  deleteManyCupons: shieldedProcedure
    .input(CuponsDeleteManySchema)
    .mutation(async ({ ctx, input }) => {
      const deleteManyCupons = await ctx.prisma.cupons.deleteMany(input);
      return deleteManyCupons;
    }),
  deleteOneCupons: shieldedProcedure
    .input(CuponsDeleteOneSchema)
    .mutation(async ({ ctx, input }) => {
      const deleteOneCupons = await ctx.prisma.cupons.delete(input);
      return deleteOneCupons;
    }),
  findFirstCupons: shieldedProcedure
    .input(CuponsFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstCupons = await ctx.prisma.cupons.findFirst(input);
      return findFirstCupons;
    }),
  findFirstCuponsOrThrow: shieldedProcedure
    .input(CuponsFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstCuponsOrThrow = await ctx.prisma.cupons.findFirstOrThrow(
        input,
      );
      return findFirstCuponsOrThrow;
    }),
  findManyCupons: shieldedProcedure
    .input(CuponsFindManySchema)
    .query(async ({ ctx, input }) => {
      const findManyCupons = await ctx.prisma.cupons.findMany(input);
      return findManyCupons;
    }),
  findUniqueCupons: shieldedProcedure
    .input(CuponsFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueCupons = await ctx.prisma.cupons.findUnique(input);
      return findUniqueCupons;
    }),
  findUniqueCuponsOrThrow: shieldedProcedure
    .input(CuponsFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniqueCuponsOrThrow = await ctx.prisma.cupons.findUniqueOrThrow(
        input,
      );
      return findUniqueCuponsOrThrow;
    }),
  groupByCupons: shieldedProcedure
    .input(CuponsGroupBySchema)
    .query(async ({ ctx, input }) => {
      const groupByCupons = await ctx.prisma.cupons.groupBy({
        where: input.where,
        orderBy: input.orderBy,
        by: input.by,
        having: input.having,
        take: input.take,
        skip: input.skip,
      });
      return groupByCupons;
    }),
  updateManyCupons: shieldedProcedure
    .input(CuponsUpdateManySchema)
    .mutation(async ({ ctx, input }) => {
      const updateManyCupons = await ctx.prisma.cupons.updateMany(input);
      return updateManyCupons;
    }),
  updateOneCupons: shieldedProcedure
    .input(CuponsUpdateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const updateOneCupons = await ctx.prisma.cupons.update(input);
      return updateOneCupons;
    }),
  upsertOneCupons: shieldedProcedure
    .input(CuponsUpsertSchema)
    .mutation(async ({ ctx, input }) => {
      const upsertOneCupons = await ctx.prisma.cupons.upsert(input);
      return upsertOneCupons;
    }),
});
