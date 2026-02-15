import { z } from 'zod';
import { PrismaClient, product_orders, products } from '@prisma/client';
import { addDays, compareAsc } from 'date-fns';
import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { log } from '../../server';
import stripeInstance from '../../stripe';
import { getStripeCustomer } from '../subscriptions/utils/getStripeCustomer';
import { PaymentService } from '../subscriptions/services/types';
import { OrderStatus } from '../subscriptions/interfaces/order-status.interface';
import { canBuyMoreGB } from './validation/canBuyMoreGB';
import { getConektaCustomer } from '../subscriptions/utils/getConektaCustomer';
import { conektaOrders } from '../../conekta';
import { SessionUser } from '../auth/utils/serialize-user';
import { addGBToAccount } from './services/addGBToAccount';

export const buyMoreGB = shieldedProcedure
  .input(
    z.union([
      z.object({
        productId: z.number(),
        paymentMethod: z.string().optional(),
        service: z.literal(PaymentService.STRIPE),
        orderId: z.never().optional(),
      }),
      z.object({
        productId: z.number(),
        service: z.literal(PaymentService.CONEKTA),
        paymentMethod: z.never().optional(),
        orderId: z.never().optional(),
      }),
      z.object({
        productId: z.number(),
        service: z.literal(PaymentService.PAYPAL),
        paymentMethod: z.never().optional(),
        orderId: z.string(),
      }),
    ]),
  )
  .mutation(
    async ({
      ctx: { prisma, session },
      input: { paymentMethod, productId, service, orderId },
    }) => {
      const user = session!.user!;

      const product = await canBuyMoreGB({ prisma, user, productId });

      log.info(
        `[PRODUCT:PURCHASE] Purchasing product ${product.id}, user ${user.id}`,
      );

      switch (service) {
        case PaymentService.STRIPE: {
          const stripeCustomer = await getStripeCustomer(prisma, user);

          const productOrder = await prisma.product_orders.create({
            data: {
              service: PaymentService.STRIPE,
              product_id: product.id,
              status: OrderStatus.PENDING,
              user_id: user.id,
              created_at: new Date(),
              payment_method: service,
            },
          });

          try {
            const productKey =
              process.env.NODE_ENV === 'production'
                ? 'stripe_product_id'
                : 'stripe_product_test_id';
            const stripeProductId = product[productKey];
            if (!stripeProductId) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Este producto no tiene configuración de Stripe.',
              });
            }

            const stripePrices = await stripeInstance.prices.list({
              product: stripeProductId,
              active: true,
              limit: 1,
            });

            const firstPrice = stripePrices.data?.[0];
            const unitAmount = firstPrice?.unit_amount;
            const currency = firstPrice?.currency;
            if (typeof unitAmount !== 'number' || !currency) {
              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Este producto no tiene un precio activo en Stripe.',
              });
            }

            const pm = typeof paymentMethod === 'string' ? paymentMethod.trim() : '';
            const pi = await stripeInstance.paymentIntents.create(
              {
                customer: stripeCustomer,
                currency,
                amount: unitAmount,
                ...(pm ? { payment_method: pm } : {}),
                payment_method_types: ['card'],
                metadata: {
                  productOrderId: String(productOrder.id),
                },
              },
              { idempotencyKey: `stripe-pi-order-${productOrder.id}` },
            );

            await prisma.product_orders.update({
              where: {
                id: productOrder.id,
              },
              data: {
                txn_id: pi.id,
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
        }
        case PaymentService.CONEKTA: {
          const conektaCustomer = await getConektaCustomer({ prisma, user });

          const existingOrder = await prisma.product_orders.findFirst({
            where: {
              AND: [
                {
                  user_id: user.id,
                },
                {
                  status: OrderStatus.PENDING,
                },
                {
                  service: PaymentService.CONEKTA,
                },
                {
                  product_id: product.id,
                },
              ],
            },
            orderBy: { id: 'desc' },
          });

          if (existingOrder) {
            try {
              const existingTxn = `${existingOrder.txn_id ?? ''}`.trim();
              if (!existingTxn) {
                throw new Error('Missing txn_id for existing conekta product order');
              }
              const conektaOrder = await conektaOrders.getOrderById(existingTxn);
              const charge = (conektaOrder.data.charges as any)?.data?.[0] as any;
              const paymentMethodObj = charge?.payment_method as any;
              const expiresAt = Number(paymentMethodObj?.expires_at ?? 0);
              const chargeStatus = String(charge?.status ?? '').toLowerCase();

              // Check if the order is expired
              if (
                compareAsc(
                  new Date(),
                  new Date(expiresAt * 1000),
                ) >= 0 ||
                chargeStatus !== 'pending_payment'
              ) {
                log.info(
                  `[CONEKTA_CASH] Order ${conektaOrder.data.id} is expired, creating new one`,
                );

                const newOrder = await createCashPaymentOrder({
                  product,
                  customerId: conektaCustomer,
                  paymentMethod: 'cash',
                  order: existingOrder,
                  prisma,
                  user,
                });

                return ((newOrder.data.charges as any)?.data?.[0]?.payment_method ?? null) as any;
              }

              return (paymentMethodObj ?? null) as any;
            } catch (e) {
              log.error(
                `[CONEKTA_CASH] There was an error getting the order with conekta: ${e}`,
              );

              throw new TRPCError({
                code: 'BAD_REQUEST',
                message: 'Ha ocurrido un error al realizar la compra.',
              });
            }
          }

          const productOrder = await prisma.product_orders.create({
            data: {
              service: PaymentService.CONEKTA,
              product_id: product.id,
              status: OrderStatus.PENDING,
              user_id: user.id,
              created_at: new Date(),
              payment_method: service,
            },
          });

	          const conektaOrder = await createCashPaymentOrder({
	            product,
	            customerId: conektaCustomer,
	            paymentMethod: 'cash',
	            order: productOrder,
	            prisma,
	            user,
	          });

	          return ((conektaOrder.data.charges as any)?.data?.[0]?.payment_method ?? null) as any;
	        }
	        case PaymentService.PAYPAL: {
	          log.info(
	            `[PRODUCT:PURCHASE] Creating paypal order for user ${user.id}`,
          );

          const productOrder = await prisma.product_orders.create({
            data: {
              service: PaymentService.PAYPAL,
              product_id: product.id,
              status: OrderStatus.PENDING,
              user_id: user.id,
              created_at: new Date(),
              payment_method: service,
              txn_id: orderId,
            },
          });

          await addGBToAccount({
            prisma,
            user,
            orderId: productOrder.id,
          });

          break;
        }
        default:
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'El servicio especificado no existe',
          });
      }

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'El servicio especificado no existe',
      });
    },
  );

const createCashPaymentOrder = async ({
  product,
  customerId,
  paymentMethod,
  order,
  prisma,
  user,
}: {
  product: products;
  customerId: string;
  paymentMethod: 'cash' | 'spei';
  order: product_orders;
  prisma: PrismaClient;
  user: SessionUser;
}) => {
  const conektaOrder = await conektaOrders.createOrder({
    currency: product.moneda ?? 'MXN',
    customer_info: {
      customer_id: customerId,
    },
    line_items: [
      {
        name: product.name,
        quantity: 1,
        unit_price: Number(product.price) * 100,
      },
    ],
    charges: [
      {
        amount: Number(product.price) * 100,
        payment_method: {
          type: paymentMethod.toLowerCase(),
          expires_at: Number(
            (addDays(new Date(), 30).getTime() / 1000).toFixed(),
          ),
        },
      },
    ],
    metadata: {
      orderId: order.id,
      userId: user.id,
      isProduct: true,
    },
  });

  await prisma.product_orders.update({
    where: {
      id: order.id,
    },
    data: {
      txn_id: conektaOrder.data.id,
    },
  });

  return conektaOrder;
};
