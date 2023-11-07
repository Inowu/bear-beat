import { Request } from 'express';
import { Stripe } from 'stripe';
import { StripeEvents } from './events';
import { log } from '../../../server';
import { PrismaClient } from '@prisma/client';
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
    case StripeEvents.INVOICE_VOID:
    case StripeEvents.INVOICE_PAYMENT_FAILED: {
      log.info(
        `[STRIPE_WH] Invoice payment failed for user ${user.id}, payload: ${payloadStr}`,
      );
      break;
    }
    case StripeEvents.INVOICE_PAID: {
      log.info(
        `[STRIPE_WH] Invoice paid for user ${user.id}, payload: ${payloadStr}`,
      );

      await addGBToAccount({
        user,
        prisma,
        productId: Number(
          (payload.data.object as Stripe.Invoice).metadata?.productId,
        ),
        orderId: Number(
          (payload.data.object as Stripe.Invoice).metadata?.orderId,
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
