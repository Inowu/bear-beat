import { Request } from 'express';
import { Stripe } from 'stripe';
import { PrismaClient } from '@prisma/client';
import { StripeEvents } from './events';
import { log } from '../../../server';
import { prisma } from '../../../db';
import { addGBToAccount } from '../../products/services/addGBToAccount';
import { OrderStatus } from '../../subscriptions/interfaces/order-status.interface';
import { getStripeWebhookBody } from '../../../utils/verifyStripeSignature';

export const stripeInvoiceWebhook = async (req: Request) => {
  const payload: Stripe.Event = JSON.parse(getStripeWebhookBody(req));

  const payloadStr = getStripeWebhookBody(req);

  if (!shouldHandleEvent(payload)) return;

  const user = await getUserFromPayload(prisma, payload);

  if (!user) {
    log.error(
      `[STRIPE_WH] User not found in event: ${payload.type}, payload: ${payloadStr}`,
    );
    return;
  }

  switch (payload.type) {
    case StripeEvents.PAYMENT_INTENT_FAILED: {
      log.info(
        `[STRIPE_WH] Payment intent failed for user ${user.id}, payload: ${payloadStr}`,
      );

      if (!payload.data.object.metadata.productOrderId) {
        log.warn(
          `[STRIPE_WH] Payment intent for user ${user.id} does not have a productOrderId, no action taken. payload: ${payloadStr}`,
        );

        return;
      }

      const order = await prisma.product_orders.findFirst({
        where: {
          id: Number(
            (payload.data.object as Stripe.PaymentIntent).metadata
              ?.productOrderId,
          ),
        },
      });

      if (!order) {
        log.warn(
          `[STRIPE_WH] Product order not found for user ${user.id}, payload: ${payloadStr}`,
        );

        return;
      }

      await prisma.product_orders.update({
        where: {
          id: order.id,
        },
        data: {
          status: OrderStatus.FAILED,
        },
      });
      break;
    }
    case StripeEvents.PAYMENT_INTENT_SUCCEEDED: {
      log.info(
        `[STRIPE_WH] Payment intent for user ${user.id}, payload: ${payloadStr}`,
      );

      if (!payload.data.object.metadata.productOrderId) {
        log.info(
          `[STRIPE_WH] Payment intent for user ${user.id} does not have a productOrderId, no action taken. payload: ${payloadStr}`,
        );
        return;
      }

      await addGBToAccount({
        user,
        prisma,
        orderId: Number(
          (payload.data.object as Stripe.PaymentIntent).metadata
            ?.productOrderId,
        ),
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
    case StripeEvents.PAYMENT_INTENT_SUCCEEDED:
    case StripeEvents.PAYMENT_INTENT_FAILED:
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
