import { Request } from 'express';
import { Stripe } from 'stripe';
import { PrismaClient } from '@prisma/client';
import { StripeEvents } from './events';
import { log } from '../../../server';
import { prisma } from '../../../db';
import { getPlanKey } from '../../../utils/getPlanKey';
import { PaymentService } from '../../subscriptions/services/types';

export const stripeProductsWebhook = async (req: Request) => {
  const payload: Stripe.Event = JSON.parse(req.body as any);

  const payloadStr = req.body;

  if (!shouldHandleEvent(payload)) return;

  const user = await getUserFromPayload(prisma, payload);

  if (!user) {
    log.error(
      `[STRIPE_WH] User not found in event: ${payload.type}, payload: ${payloadStr}`,
    );
    return;
  }

  switch (payload.type) {
    case StripeEvents.PRODUCT_UPDATED: {
      log.info(
        `[STRIPE_WH] Updating stripe product ${payload.data.object.id}, payload: ${payloadStr}`,
      );

      const stripeProduct = payload.data.object as Stripe.Product;

      const plan = await prisma.plans.findFirst({
        where: {
          [getPlanKey(PaymentService.STRIPE)]: stripeProduct.id,
        },
      });

      if (!plan) {
        log.warn(
          `[STRIPE_WH] Plan not found in event: ${payload.type}, looking for product instead, payload: ${payloadStr}`,
        );

        const product = await prisma.products.findFirst({
          where: {
            [getPlanKey(PaymentService.STRIPE)]: stripeProduct.id,
          },
        });

        if (!product) {
          log.error(
            `[STRIPE_WH] Product not found in event: ${payload.type}, payload: ${payloadStr}`,
          );
          return;
        }

        await prisma.products.update({
          where: {
            id: product.id,
          },
          data: {},
        });

        await prisma.plans.update({
          where: {
            id: product.id,
          },
          data: {
            name: stripeProduct.name,
            ...(stripeProduct.description
              ? { description: stripeProduct.description }
              : {}),
          },
        });

        return;
      }

      await prisma.plans.update({
        where: {
          id: plan.id,
        },
        data: {
          name: stripeProduct.name,
          ...(stripeProduct.description
            ? { description: stripeProduct.description }
            : {}),
        },
      });

      break;
    }
    case StripeEvents.PRICE_UPDATED: {
      log.info(
        `[STRIPE_WH] Updating stripe price for product ${payload.data.object.id}, payload: ${payloadStr}`,
      );

      const stripePrice = payload.data.object as Stripe.Price;

      const plan = await prisma.plans.findFirst({
        where: {
          [getPlanKey(PaymentService.STRIPE)]: stripePrice.product,
        },
      });

      if (!plan) {
        log.warn(
          `[STRIPE_WH] Plan not found in event: ${payload.type}, looking for product instead, payload: ${payloadStr}`,
        );

        const product = await prisma.products.findFirst({
          where: {
            [getPlanKey(PaymentService.STRIPE)]: stripePrice.product,
          },
        });

        if (!product) {
          log.error(
            `[STRIPE_WH] Product not found in event: ${payload.type}, payload: ${payloadStr}`,
          );
          return;
        }

        await prisma.products.update({
          where: {
            id: product.id,
          },
          data: {},
        });

        await prisma.plans.update({
          where: {
            id: product.id,
          },
          data: {
            ...(stripePrice.unit_amount
              ? { price: stripePrice.unit_amount / 100 }
              : {}),
          },
        });

        return;
      }

      await prisma.plans.update({
        where: {
          id: plan.id,
        },
        data: {
          ...(stripePrice.unit_amount
            ? { price: stripePrice.unit_amount / 100 }
            : {}),
        },
      });
      break;
    }
    default: {
      log.info(
        `[STRIPE_WH] Unhandled event ${payload.type}, payload: ${payloadStr}`,
      );
    }
  }
};

const shouldHandleEvent = (payload: Stripe.Event): boolean => {
  switch (payload.type) {
    case StripeEvents.PRODUCT_UPDATED:
    case StripeEvents.PRICE_UPDATED:
      return true;
    default:
      log.info(
        `[STRIPE_WH] Uhandled event ${payload.type}, payload: ${JSON.stringify(
          payload,
        )}`,
      );
      return false;
  }
};

const getUserFromPayload = async (
  prismaClient: PrismaClient,
  payload: Stripe.Event,
) => {
  const { customer } = payload.data.object as Stripe.PaymentIntent;

  const user = await prismaClient.users.findFirst({
    where: {
      stripe_cusid: typeof customer === 'string' ? customer : customer?.id,
    },
  });

  return user;
};
