import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import Stripe from 'stripe';
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
import stripeInstance, { isStripeConfigured } from '../stripe';
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
    .query(async ({ input: { code }, ctx: { session, prisma } }) => {
      const user = session!.user!;

      const coupon = await prisma.cupons.findFirst({
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

      if (!coupon) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Cupón no encontrado',
        });
      }

      const usedCoupon = await prisma.cuponsUsed.findFirst({
        where: {
          AND: [
            {
              user_id: user.id,
            },
            { cupon_id: coupon.id },
          ],
        },
      });

      if (usedCoupon) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cupón ya utilizado',
        });
      }

      return {
        discount: coupon.discount,
      };
    }),
  createStripeCupon: shieldedProcedure
    .input(CuponsCreateOneSchema)
    .mutation(async ({ input, ctx: { prisma } }) => {
      try {
        const code = String((input.data as any)?.code ?? '').trim();
        if (!code) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'El código es requerido' });
        }
        if (code.length > 15) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'El código del cupón no puede exceder 15 caracteres',
          });
        }

        const percentOff = Number((input.data as any)?.discount);
        if (!Number.isFinite(percentOff) || percentOff <= 0 || percentOff > 100) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'El descuento debe ser un número entre 1 y 100' });
        }

        const isActive = Number((input.data as any)?.active) === 1;

        // Keep Stripe in sync with DB coupons to prevent checkout failures when applying discounts.
        if (isStripeConfigured()) {
          let stripeCoupon: Stripe.Coupon | null = null;
          try {
            stripeCoupon = await stripeInstance.coupons.retrieve(code);
          } catch (e: any) {
            const isMissing =
              e?.code === 'resource_missing' ||
              (typeof e?.message === 'string' && e.message.toLowerCase().includes('no such coupon'));
            if (!isMissing) throw e;
          }

          if (!stripeCoupon) {
            await stripeInstance.coupons.create({
              name: code,
              id: code,
              percent_off: percentOff,
              duration: 'once',
            });
          } else {
            const existingPercentOff = stripeCoupon.percent_off;
            const hasPercentOff = typeof existingPercentOff === 'number';
            if (!hasPercentOff || Number(existingPercentOff) !== percentOff) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: `En Stripe ya existe un cupón con el código ${code} pero con un descuento diferente. Usa otro código.`,
              });
            }
          }

          // If Checkout uses allow_promotion_codes, the customer-facing code is a Promotion Code.
          // Create (or keep updated) a promotion code with the same value as our coupon code.
          try {
            const existing = await stripeInstance.promotionCodes.list({ code, limit: 1 });
            const promo = existing.data[0] ?? null;
            if (!promo) {
              await stripeInstance.promotionCodes.create({
                promotion: { type: 'coupon', coupon: code },
                code,
                active: isActive,
              });
            } else {
              const promoCouponRaw = promo.promotion?.coupon ?? null;
              const promoCouponId =
                typeof promoCouponRaw === 'string' ? promoCouponRaw : promoCouponRaw?.id ?? null;
              if (promoCouponId !== code) {
                throw new TRPCError({
                  code: 'BAD_REQUEST',
                  message: `En Stripe ya existe un promotion code ${code} asociado a otro cupón. Usa otro código.`,
                });
              }
              if (promo.active !== isActive) {
                await stripeInstance.promotionCodes.update(promo.id, { active: isActive });
              }
            }
          } catch (e: any) {
            log.warn('[COUPONS] Promotion code sync skipped', {
              code,
              error: e instanceof Error ? e.message : e,
            });
          }
        } else {
          log.warn('[COUPONS] Stripe not configured; creating coupon in DB only (local/dev)', { code });
        }

        await prisma.cupons.create({
          ...(input.select ? { select: input.select } : {}),
          data: { ...(input.data as any), code, discount: percentOff },
        });
        return { code };
      } catch (e: any) {
        log.error(`[COUPONS] Error creating coupon: ${e.message}`);
        if (e instanceof TRPCError) throw e;
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
    .mutation(async ({ input: { code }, ctx: { prisma } }) => {
      try {
        try {
          await stripeInstance.coupons.retrieve(code);

          await stripeInstance.coupons.del(code);
        } catch (e) {
          log.warn(`[COUPONS] Coupon ${code} does not exist in Stripe`);
        }

        await prisma.cupons.delete({
          where: {
            code,
          },
        });

        log.info(`[COUPONS] Coupon ${code} was deleted`);

        return {
          message: `Cupón ${code} fue eliminado`,
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
        const updated = await prisma.cupons.update({
          where: input.where,
          data: {
            description: input.data.description,
            active: input.data.active,
          },
          select: { code: true, active: true },
        });

        // Keep Stripe promotion code active flag in sync with DB.
        if (isStripeConfigured() && input.data.active !== undefined) {
          const isActive = Number(updated.active) === 1;
          try {
            const existing = await stripeInstance.promotionCodes.list({ code: updated.code, limit: 1 });
            const promo = existing.data[0] ?? null;
            if (promo && promo.active !== isActive) {
              await stripeInstance.promotionCodes.update(promo.id, { active: isActive });
            }
          } catch (e: any) {
            log.warn('[COUPONS] Promotion code active sync skipped', {
              code: updated.code,
              error: e instanceof Error ? e.message : e,
            });
          }
        }

        return updated;
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
      const findFirstCuponsOrThrow =
        await ctx.prisma.cupons.findFirstOrThrow(input);
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
      const findUniqueCuponsOrThrow =
        await ctx.prisma.cupons.findUniqueOrThrow(input);
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
