import { Request } from 'express';
import { Stripe } from 'stripe';
import { PrismaClient } from '@prisma/client';
import { StripeEvents } from './events';
import { log } from '../../../server';
import { prisma } from '../../../db';
import { addGBToAccount } from '../../products/services/addGBToAccount';

export const stripeInvoiceWebhook = async (req: Request) => {
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
    case StripeEvents.PAYMENT_INTENT_FAILED: {
      log.info(
        `[STRIPE_WH] Payment intent failed for user ${user.id}, payload: ${payloadStr}`,
      );
      break;
    }
    case StripeEvents.PAYMENT_INTENT_SUCCEEDED: {
      log.info(
        `[STRIPE_WH] Payment intent for user ${user.id}, payload: ${payloadStr}`,
      );

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
    case StripeEvents.INVOICE_PAID:
    case StripeEvents.INVOICE_PAYMENT_FAILED:
    case StripeEvents.INVOICE_VOID:
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
  prisma: PrismaClient,
  payload: Stripe.Event,
) => {
  const customer = (payload.data.object as Stripe.Invoice).customer;

  const user = await prisma.users.findFirst({
    where: {
      stripe_cusid: typeof customer === 'string' ? customer : customer?.id,
    },
  });

  return user;
};
