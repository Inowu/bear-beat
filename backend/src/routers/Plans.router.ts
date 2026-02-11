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
import { OrderStatus } from './subscriptions/interfaces/order-status.interface';
import { paypal } from '../paypal';
import { manyChat } from '../many-chat';
import { getMarketingTrialConfigFromEnv } from '../utils/trialConfig';
import { StripePriceKey } from './subscriptions/utils/ensureStripePriceId';

type StripeRecurringInterval = 'day' | 'week' | 'month' | 'year';

function normalizeRecurringInterval(value: unknown): StripeRecurringInterval {
  if (value === 'day' || value === 'week' || value === 'month' || value === 'year') return value;
  return 'month';
}

async function resolveStripeProductAndRecurring(
  stripeIdentifier: string,
): Promise<{
  productId: string;
  recurring: { interval: StripeRecurringInterval; interval_count: number };
}> {
  if (stripeIdentifier.startsWith('price_')) {
    const price = await stripeInstance.prices.retrieve(stripeIdentifier);
    const productId = typeof price.product === 'string' ? price.product : price.product.id;
    return {
      productId,
      recurring: {
        interval: normalizeRecurringInterval(price.recurring?.interval),
        interval_count: price.recurring?.interval_count ?? 1,
      },
    };
  }

  if (stripeIdentifier.startsWith('plan_')) {
    const legacyPlan = await stripeInstance.plans.retrieve(stripeIdentifier);
    if (!legacyPlan.product) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No se pudo resolver el producto del plan de Stripe.',
      });
    }
    const productId =
      typeof legacyPlan.product === 'string' ? legacyPlan.product : legacyPlan.product.id;
    return {
      productId,
      recurring: {
        interval: normalizeRecurringInterval(legacyPlan.interval),
        interval_count: legacyPlan.interval_count ?? 1,
      },
    };
  }

  if (stripeIdentifier.startsWith('prod_')) {
    return {
      productId: stripeIdentifier,
      recurring: { interval: 'month', interval_count: 1 },
    };
  }

  throw new TRPCError({
    code: 'BAD_REQUEST',
    message: 'El identificador de Stripe del plan es inválido.',
  });
}

export const plansRouter = router({
  getTrialConfig: shieldedProcedure.query(async ({ ctx }) => {
    const config = getMarketingTrialConfigFromEnv();

    // `eligible` is best-effort: null when unauthenticated / unknown.
    let eligible: boolean | null = null;
    const userId = ctx.session?.user?.id;
    if (userId) {
      const user = await ctx.prisma.users.findFirst({
        where: { id: userId },
        select: { trial_used_at: true, phone: true },
      });
      if (user) {
        if (!config.enabled || user.trial_used_at) {
          eligible = false;
        } else {
          const previousPaidPlanOrder = await ctx.prisma.orders.findFirst({
            where: {
              user_id: userId,
              status: OrderStatus.PAID,
              is_plan: 1,
            },
            select: { id: true },
          });
          eligible = !previousPaidPlanOrder;

          // Anti-abuse guard: if another account with the same phone already used a trial
          // or has a paid plan, treat this user as not eligible for a new "first time" trial.
          const phone = (user.phone ?? '').trim();
          if (eligible && phone) {
            try {
              const samePhoneUsers = await ctx.prisma.users.findMany({
                where: {
                  id: { not: userId },
                  phone,
                },
                select: { id: true, trial_used_at: true },
                take: 5,
              });

              const samePhoneHasTrial = samePhoneUsers.some((row) => Boolean(row.trial_used_at));
              let samePhoneHasPaid = false;
              if (!samePhoneHasTrial && samePhoneUsers.length > 0) {
                const paid = await ctx.prisma.orders.findFirst({
                  where: {
                    user_id: { in: samePhoneUsers.map((row) => row.id) },
                    status: OrderStatus.PAID,
                    is_plan: 1,
                  },
                  select: { id: true },
                });
                samePhoneHasPaid = Boolean(paid);
              }

              if (samePhoneHasTrial || samePhoneHasPaid) {
                eligible = false;
              }
            } catch {
              // Best-effort only; do not break trial config query.
            }
          }
        }
      }
    }

    return {
      enabled: config.enabled,
      days: config.days,
      gb: config.gb,
      eligible,
    };
  }),
  createStripePlan: shieldedProcedure
    .input(
      z.intersection(
        PlansCreateOneSchema,
        z.object({
          interval: z.union([z.literal('month'), z.literal('year')]).optional(),
        }),
      ),
    )
    .mutation(async ({ ctx: { prisma }, input: { data, interval } }) => {
      try {
        const priceKey = getPlanKey(PaymentService.STRIPE) as StripePriceKey;
        const recurringInterval = normalizeRecurringInterval(interval?.toLowerCase());
        const currency = (data.moneda?.toLowerCase() || 'usd').trim();
        const unitAmount = Math.round(Number(data.price) * 100);

        if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'El precio del plan debe ser mayor a cero',
          });
        }

        const stripeProduct = await stripeInstance.products.create({
          name: data.name,
          active: data.activated == null ? true : Boolean(data.activated),
          description: data.description,
        });

        const stripePrice = await stripeInstance.prices.create({
          product: stripeProduct.id,
          currency,
          unit_amount: unitAmount,
          recurring: {
            interval: recurringInterval,
            interval_count: 1,
          },
        });

        const prismaPlan = await prisma.plans.create({
          data: {
            ...data,
            [priceKey]: stripePrice.id,
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
  updateStripePlan: shieldedProcedure
    .input(PlansUpdateOneSchema)
    .mutation(async ({ ctx: { prisma }, input }) => {
      const { where, data } = input;

      const plan = await prisma.plans.findUnique({
        where,
      });

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plan no encontrado',
        });
      }

      const stripeId = plan[getPlanKey(PaymentService.STRIPE)];

      if (!stripeId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'El plan no tiene un id de stripe asociado',
        });
      }

      try {
        const priceKey = getPlanKey(PaymentService.STRIPE) as StripePriceKey;
        const stripeIdentifier = plan[priceKey] as string;
        const { productId, recurring } = await resolveStripeProductAndRecurring(stripeIdentifier);

        const productUpdate: Record<string, unknown> = {};
        if (data.name !== undefined) productUpdate.name = data.name as string;
        if (data.activated !== undefined) productUpdate.active = Boolean(data.activated);
        if (data.description !== undefined) {
          productUpdate.description = (data.description as string) || '';
        }

        if (Object.keys(productUpdate).length > 0) {
          await stripeInstance.products.update(productId, productUpdate);
        }

        const shouldCreateNewPrice =
          data.price !== undefined ||
          data.moneda !== undefined ||
          !stripeIdentifier.startsWith('price_');

        let replacementPriceId: string | null = null;
        if (shouldCreateNewPrice) {
          const unitAmount = Math.round(Number((data.price as any) ?? plan.price) * 100);
          if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'El precio del plan debe ser mayor a cero',
            });
          }

          const currencyRaw = String((data.moneda as any) ?? plan.moneda ?? 'usd')
            .trim()
            .toLowerCase();
          const currency = /^[a-z]{3}$/.test(currencyRaw) ? currencyRaw : 'usd';

          const replacementPrice = await stripeInstance.prices.create({
            product: productId,
            currency,
            unit_amount: unitAmount,
            recurring,
          });
          replacementPriceId = replacementPrice.id;
        }

        const prismaPlan = await prisma.plans.update({
          where,
          data: {
            ...(data as Record<string, unknown>),
            ...(replacementPriceId ? { [priceKey]: replacementPriceId } : {}),
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
  deleteStripePlan: shieldedProcedure
    .input(PlansDeleteOneSchema)
    .mutation(async ({ ctx: { prisma }, input }) => {
      const { where } = input;

      const plan = await prisma.plans.findUnique({
        where,
      });

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plan no encontrado',
        });
      }

      const stripeId = plan[getPlanKey(PaymentService.STRIPE)];

      if (!stripeId) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'El plan no tiene un id de stripe asociado',
        });
      }

      try {
        const priceKey = getPlanKey(PaymentService.STRIPE) as StripePriceKey;
        const stripeIdentifier = plan[priceKey] as string;
        const { productId } = await resolveStripeProductAndRecurring(stripeIdentifier);

        await stripeInstance.products.update(productId, { active: false });

        const prismaPlan = await prisma.plans.update({
          where,
          data: {
            [priceKey]: null,
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
        PlansUpdateOneSchema,
        z.object({
          interval: z.union([z.literal('month'), z.literal('year')]).optional(),
        }),
      ),
    )
    .mutation(async ({ ctx: { prisma }, input: { data, where, interval } }) => {
      try {
        const token = await paypal.getToken();

        const planWithProduct = await prisma.plans.findFirst({
          where: {
            NOT: [
              {
                paypal_product_id: null,
              },
            ],
          },
        });

        let paypalProductId = planWithProduct?.paypal_product_id;
        if (!paypalProductId) {
          const productResponse = (
            await axios.post(
              `${paypal.paypalUrl()}/v1/catalogs/products`,
              {
                name: data.name,
                description: data.description || 'Bear Beat subscription',
                type: 'SERVICE',
                category: 'SOFTWARE',
              },
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  'Content-Type': 'application/json',
                },
              },
            )
          ).data;

          paypalProductId = productResponse.id as string;
        }

        const planResponse = (
          await axios.post(
            `${paypal.paypalUrl()}/v1/billing/plans`,
            {
              product_id: paypalProductId,
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
                      currency_code:
                        (data.moneda as string)?.toUpperCase() || 'USD',
                    },
                  },
                  frequency: {
                    interval_unit: interval?.toUpperCase() || 'MONTH',
                    interval_count: 1,
                  },
                },
              ],
              payment_preferences: {
                auto_bill_outstanding: true,
                setup_fee: {
                  value: '0',
                  currency_code:
                    (data.moneda as string)?.toUpperCase() || 'USD',
                },
              },
            },
            {
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
            },
          )
        ).data;

        return await prisma.plans.create({
          data: {
            ...(data as any),
            paypal_product_id: paypalProductId,
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
  deactivatePaypalPlan: shieldedProcedure
    .input(
      z.object({
        id: z.number(),
      }),
    )
    .mutation(async ({ ctx: { prisma }, input: { id } }) => {
      const plan = await prisma.plans.findUnique({
        where: {
          id,
        },
      });

      if (!plan) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Plan no encontrado',
        });
      }

      try {
        const token = await paypal.getToken();
        const paypalPlanKey = getPlanKey(PaymentService.PAYPAL);
        const paypalPlanId = plan[paypalPlanKey];
        if (!paypalPlanId) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'El plan no tiene un id de PayPal asociado',
          });
        }

        await axios.post(
          `${paypal.paypalUrl()}/v1/billing/plans/${paypalPlanId}/deactivate`,
          {},
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          },
        );

        return await prisma.plans.update({
          where: { id: plan.id },
          data: {
            [paypalPlanKey]: null,
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
      const findFirstPlansOrThrow =
        await ctx.prisma.plans.findFirstOrThrow(input);
      return findFirstPlansOrThrow;
    }),
  findManyPlans: shieldedProcedure
    .input(PlansFindManySchema)
    .query(async ({ ctx, input }) => {
      const findManyPlans = await ctx.prisma.plans.findMany(input);
      // Production audits are READ-ONLY. When the auditor sets this header, avoid
      // triggering external side-effects (ManyChat tags/custom fields) from a query.
      const auditReadOnlyHeader = ctx.req?.headers?.['x-bb-audit-readonly'];
      const isAuditReadOnly = auditReadOnlyHeader === '1';

      if (!isAuditReadOnly && ctx.session?.user?.id && findManyPlans.length > 0) {
        const user = await ctx.prisma.users.findFirst({
          where: { id: ctx.session.user.id },
        });
        if (user) {
          const whereAny = input.where as Record<string, unknown> | undefined;
          const hasSinglePlanId =
            whereAny?.id !== undefined && findManyPlans.length === 1;
          if (hasSinglePlanId) {
            const plan = findManyPlans[0];
            const name = (plan?.name ?? '').toString();
            if (name.includes('Oro')) {
              manyChat.addTagToUser(user, 'CHECKOUT_PLAN_ORO').catch(() => {});
            } else if (name.includes('Curioso')) {
              manyChat.addTagToUser(user, 'CHECKOUT_PLAN_CURIOSO').catch(() => {});
            }
            const mcId = await manyChat.getManyChatId(user);
            if (mcId && plan) {
              manyChat.setCustomField(mcId, 'ultimo_plan_checkout', name).catch(() => {});
              manyChat.setCustomField(mcId, 'ultimo_precio_checkout', String(plan.price ?? '')).catch(() => {});
            }
          } else {
            manyChat.addTagToUser(user, 'USER_CHECKED_PLANS').catch(() => {});
          }
        }
      }
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
      const findUniquePlansOrThrow =
        await ctx.prisma.plans.findUniqueOrThrow(input);
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
