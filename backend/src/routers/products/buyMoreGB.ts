import { z } from 'zod';
import { Orders, PrismaClient, product_orders, products } from '@prisma/client';
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

export const buyMoreGBStripe = shieldedProcedure
  .input(
    z.union([
      z.object({
        productId: z.number(),
        paymentMethod: z.string(),
        service: z.literal(PaymentService.STRIPE),
      }),
      z.object({
        productId: z.number(),
        service: z.literal(PaymentService.CONEKTA),
        paymentMethod: z.never(),
      }),
      z.object({
        productId: z.number(),
        service: z.literal(PaymentService.PAYPAL),
        paymentMethod: z.never(),
      }),
    ]),
  )
  .mutation(
    async ({
      ctx: { prisma, session },
      input: { paymentMethod, productId, service },
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
              created_at: new Date().toISOString(),
              payment_method: service,
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
        }
        case PaymentService.CONEKTA: {
          const conektaCustomer = await getConektaCustomer({ prisma, user });

          const productOrder = await prisma.product_orders.create({
            data: {
              service: PaymentService.STRIPE,
              product_id: product.id,
              status: OrderStatus.PENDING,
              user_id: user.id,
              created_at: new Date().toISOString(),
              payment_method: service,
            },
          });

          const existingOrder = await prisma.product_orders.findFirst({
            where: {
              AND: [
                {
                  user_id: user.id,
                },
                {
                  status: OrderStatus.PENDING,
                },
              ],
            },
          });

          if (existingOrder) {
            try {
              const conektaOrder = await conektaOrders.getOrderById(
                existingOrder.txn_id!,
              );

              // Check if the order is expired
              if (
                compareAsc(
                  new Date(),
                  new Date(
                    ((
                      conektaOrder.data.charges?.data?.[0].payment_method as any
                    )?.expires_at ?? 0) * 1000,
                  ),
                ) >= 0 ||
                conektaOrder.data.charges?.data?.[0].status !==
                  'pending_payment'
              ) {
                log.info(
                  `[CONEKTA_CASH] Order ${conektaOrder.data.id} is expired, creating new one`,
                );

                const newOrder = await createCashPaymentOrder({
                  product,
                  customerId: conektaCustomer,
                  paymentMethod: 'cash',
                  order: productOrder,
                  prisma,
                  user,
                });

                return newOrder.data.charges?.data?.[0].payment_method as any;
              }

              return conektaOrder.data.charges?.data?.[0].payment_method as any;
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

          break;
        }
        case PaymentService.PAYPAL: {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'El servicio especificado no está disponible',
          });
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
    currency: product.currency ?? 'MXN',
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

  await prisma.orders.update({
    where: {
      id: order.id,
    },
    data: {
      invoice_id: conektaOrder.data.id,
      txn_id: (conektaOrder.data.object as any).id,
    },
  });

  return conektaOrder;
};
