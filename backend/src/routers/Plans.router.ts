import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import axios from 'axios';
import { shieldedProcedure } from '../procedures/shielded.procedure';
import { router } from '../trpc';
import { PlansAggregateSchema } from '../schemas/aggregatePlans.schema';
import { PlansCreateManySchema } from '../schemas/createManyPlans.schema';
import { PlansCreateOneSchema } from '../schemas/createOnePlans.schema';
import { PlansDeleteManySchema } from '../schemas/deleteManyPlans.schema';
import { PlansDeleteOneSchema } from '../schemas/deleteOnePlans.schema';
import { PlansFindFirstSchema } from '../schemas/findFirstPlans.schema';
import { PlansFindManySchema } from '../schemas/findManyPlans.schema';
import { PlansFindUniqueSchema } from '../schemas/findUniquePlans.schema';
import { PlansGroupBySchema } from '../schemas/groupByPlans.schema';
import { PlansUpdateManySchema } from '../schemas/updateManyPlans.schema';
import { PlansUpdateOneSchema } from '../schemas/updateOnePlans.schema';
import { PlansUpsertSchema } from '../schemas/upsertOnePlans.schema';
import stripeInstance from '../stripe';
import { log } from '../server';
import { getPlanKey } from '../utils/getPlanKey';
import { PaymentService } from './subscriptions/services/types';
import { paypal } from '../paypal';

export const plansRouter = router({
  createStripePlan: shieldedProcedure
    .input(
      z.intersection(
        PlansCreateOneSchema,
        z.object({
          data: z.object({
            interval: z
              .union([z.literal('month'), z.literal('year')])
              .optional(),
          }),
        }),
      ),
    )
    .mutation(async ({ ctx: { prisma }, input: { data } }) => {
      try {
        const stripeProduct = await stripeInstance.products.create({
          name: data.name,
          active: Boolean(data.activated) || true,
          description: data.description,
          default_price_data: {
            currency: data.moneda || 'usd',
            unit_amount: Number(data.price) * 100,
            recurring: {
              interval: data.interval || 'month',
              interval_count: 1,
            },
          },
        });

        /* eslint-disable-next-line no-param-reassign */
        delete data.interval;

        const prismaPlan = await prisma.plans.create({
          data: {
            ...data,
            [getPlanKey(PaymentService.STRIPE)]: stripeProduct.id,
          },
        });

        return prismaPlan;
      } catch (e) {
        log.error(
          `[PLANS:CREATE_STRIPE_PLAN] An error ocurred while creating a stripe plan: ${JSON.stringify(
            e,
          )}`,
        );

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Ocurrió un error al crear el plan de stripe',
        });
      }
    }),
  createPaypalPlan: shieldedProcedure
    .input(
      z.intersection(
        PlansCreateOneSchema,
        z.object({
          data: z.object({
            interval: z
              .union([z.literal('month'), z.literal('year')])
              .optional(),
          }),
        }),
      ),
    )
    .mutation(async ({ ctx: { prisma }, input: { data } }) => {
      try {
        const token = await paypal.getToken();

        const productResponse = (
          await axios.post(
            `${paypal.paypalUrl()}/v1/catalogs/products`,
            {
              name: data.name,
              description: data.description,
              type: 'SERVICE',
              category: 'ECOMMERCE_SERVICES',
              home_url: 'https://thebearbeat.com',
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          )
        ).data;

        const planResponse = (
          await axios.post(
            `${paypal.paypalUrl()}/v1/billing/plans`,
            {
              product_id: productResponse.id,
              name: data.name,
              description: data.description,
              status: 'ACTIVE',
              billing_cycles: [
                {
                  tenure_type: 'REGULAR',
                  sequence: 1,
                  total_cycles: 0,
                  pricing_scheme: {
                    fixed_price: {
                      value: data.price,
                      currency_code: data.moneda || 'USD',
                    },
                  },
                  frequency: {
                    interval_unit: data.interval?.toUpperCase() || 'MONTH',
                    interval_count: 1,
                  },
                },
              ],
              payment_preferences: {
                auto_bill_outstanding: true,
                setup_fee: {
                  value: '0',
                  currency_code: data.moneda || 'USD',
                },
              },
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          )
        ).data;

        /* eslint-disable-next-line no-param-reassign */
        delete data.interval;

        return await prisma.plans.create({
          data: {
            ...data,
            [getPlanKey(PaymentService.PAYPAL)]: planResponse.id,
          },
        });
      } catch (e) {
        log.error(
          `[PLANS:CREATE_PAYPAL_PLAN] An error ocurred while creating a paypal plan: ${JSON.stringify(
            e,
          )}`,
        );

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Ocurrió un error al crear el plan de paypal',
        });
      }
    }),
  aggregatePlans: shieldedProcedure
    .input(PlansAggregateSchema)
    .query(async ({ ctx, input }) => {
      const aggregatePlans = await ctx.prisma.plans.aggregate(input);
      return aggregatePlans;
    }),
  createManyPlans: shieldedProcedure
    .input(PlansCreateManySchema)
    .mutation(async ({ ctx, input }) => {
      const createManyPlans = await ctx.prisma.plans.createMany(input);
      return createManyPlans;
    }),
  createOnePlans: shieldedProcedure
    .input(PlansCreateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const createOnePlans = await ctx.prisma.plans.create(input);
      return createOnePlans;
    }),
  deleteManyPlans: shieldedProcedure
    .input(PlansDeleteManySchema)
    .mutation(async ({ ctx, input }) => {
      const deleteManyPlans = await ctx.prisma.plans.deleteMany(input);
      return deleteManyPlans;
    }),
  deleteOnePlans: shieldedProcedure
    .input(PlansDeleteOneSchema)
    .mutation(async ({ ctx, input }) => {
      const deleteOnePlans = await ctx.prisma.plans.delete(input);
      return deleteOnePlans;
    }),
  findFirstPlans: shieldedProcedure
    .input(PlansFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstPlans = await ctx.prisma.plans.findFirst(input);
      return findFirstPlans;
    }),
  findFirstPlansOrThrow: shieldedProcedure
    .input(PlansFindFirstSchema)
    .query(async ({ ctx, input }) => {
      const findFirstPlansOrThrow = await ctx.prisma.plans.findFirstOrThrow(
        input,
      );
      return findFirstPlansOrThrow;
    }),
  findManyPlans: shieldedProcedure
    .input(PlansFindManySchema)
    .query(async ({ ctx, input }) => {
      const findManyPlans = await ctx.prisma.plans.findMany(input);
      return findManyPlans;
    }),
  findUniquePlans: shieldedProcedure
    .input(PlansFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniquePlans = await ctx.prisma.plans.findUnique(input);
      return findUniquePlans;
    }),
  findUniquePlansOrThrow: shieldedProcedure
    .input(PlansFindUniqueSchema)
    .query(async ({ ctx, input }) => {
      const findUniquePlansOrThrow = await ctx.prisma.plans.findUniqueOrThrow(
        input,
      );
      return findUniquePlansOrThrow;
    }),
  groupByPlans: shieldedProcedure
    .input(PlansGroupBySchema)
    .query(async ({ ctx, input }) => {
      const groupByPlans = await ctx.prisma.plans.groupBy({
        where: input.where,
        orderBy: input.orderBy,
        by: input.by,
        having: input.having,
        take: input.take,
        skip: input.skip,
      });
      return groupByPlans;
    }),
  updateManyPlans: shieldedProcedure
    .input(PlansUpdateManySchema)
    .mutation(async ({ ctx, input }) => {
      const updateManyPlans = await ctx.prisma.plans.updateMany(input);
      return updateManyPlans;
    }),
  updateOnePlans: shieldedProcedure
    .input(PlansUpdateOneSchema)
    .mutation(async ({ ctx, input }) => {
      const updateOnePlans = await ctx.prisma.plans.update(input);
      return updateOnePlans;
    }),
  upsertOnePlans: shieldedProcedure
    .input(PlansUpsertSchema)
    .mutation(async ({ ctx, input }) => {
      const upsertOnePlans = await ctx.prisma.plans.upsert(input);
      return upsertOnePlans;
    }),
});
