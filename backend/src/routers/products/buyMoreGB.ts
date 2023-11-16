import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { log } from '../../server';
import stripeInstance from '../../stripe';
import { getStripeCustomer } from '../subscriptions/utils/getStripeCustomer';
import { PaymentService } from '../subscriptions/services/types';
import { OrderStatus } from '../subscriptions/interfaces/order-status.interface';

export const buyMoreGBStripe = shieldedProcedure
  .input(
    z.object({
      productId: z.number(),
      paymentMethod: z.string(),
    }),
  )
  .mutation(
    async ({
      ctx: { prisma, session },
      input: { paymentMethod, productId },
    }) => {
      const user = session!.user!;

      const userFTP = await prisma.ftpUser.findFirst({
        where: {
          user_id: user.id,
        },
      });

      if (!userFTP) {
        log.info(`[PRODUCT:PURCHASE] User ${user.id} does not have an FTP`);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'El usuario no tiene una cuenta FTP',
        });
      }

      const quotaLimits = await prisma.ftpQuotaLimits.findFirst({
        where: {
          name: userFTP.userid,
        },
      });

      if (!quotaLimits) {
        log.info(
          `[PRODUCT:PURCHASE] User ${user.id} does not have a quota limit`,
        );

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'El usuario no tiene quotas activas',
        });
      }

      const quotaTallies = await prisma.ftpquotatallies.findFirst({
        where: {
          name: userFTP.userid,
        },
      });

      if (!quotaTallies) {
        log.info(
          `[PRODUCT:PURCHASE] User ${user.id} does not have quota tallies`,
        );

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'El usuario no tiene quotas activas',
        });
      }

      if (quotaTallies.bytes_out_used < quotaLimits.bytes_out_avail) {
        log.info(
          `[PRODUCT:PURCHASE] User ${user.id} still has storage available`,
        );

        throw new TRPCError({
          code: 'CONFLICT',
          message: 'El usuario aun tiene bytes disponible',
        });
      }

      const product = await prisma.products.findFirst({
        where: {
          id: productId,
        },
      });

      if (!product) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'El producto no existe.',
        });
      }

      const descargasUser = await prisma.descargasUser.findFirst({
        where: {
          AND: [
            {
              user_id: user.id,
            },
            {
              date_end: {
                gt: new Date().toISOString(),
              },
            },
          ],
        },
      });

      if (!descargasUser) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'El usuario no tiene una suscripción activa.',
        });
      }

      log.info(
        `[PRODUCT:PURCHASE] Purchasing product ${product.id}, user ${user.id}`,
      );

      const stripeCustomer = await getStripeCustomer(prisma, user);

      const productOrder = await prisma.product_orders.create({
        data: {
          service: PaymentService.STRIPE,
          product_id: product.id,
          status: OrderStatus.PENDING,
          user_id: user.id,
          created_at: new Date().toISOString(),
        },
      });

      try {
        const stripePrices = await stripeInstance.prices.list({
          product:
            product[
              process.env.NODE_ENV === 'production'
                ? 'stripe_product_id'
                : 'stripe_product_test_id'
            ],
        });

        const pi = await stripeInstance.paymentIntents.create({
          customer: stripeCustomer,
          currency: stripePrices.data[0].currency,
          amount: stripePrices.data[0].unit_amount as number,
          payment_method: paymentMethod,
          metadata: {
            productOrderId: productOrder.id,
          },
        });

        log.info(`[PRODUCT:PURCHASE] Payment intent ${pi.id} created`);

        return {
          message:
            'Se ha realizado la compra correctamente. En unos momentos se actualizará el saldo de tu cuenta.',
          clientSecret: pi.client_secret,
        };
      } catch (e: any) {
        log.error(`[PRODUCT:PURCHASE] Error: ${e.message}`);

        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ha ocurrido un error al realizar la compra.',
        });
      }
    },
  );
