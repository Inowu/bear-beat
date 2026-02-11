import { Request } from 'express';
import { Stripe } from 'stripe';
import { StripeEvents } from './events';
import { log } from '../../../server';
import { prisma } from '../../../db';
import stripeInstance from '../../../stripe';
import { getPlanKey } from '../../../utils/getPlanKey';
import { PaymentService } from '../../subscriptions/services/types';
import { getStripeWebhookBody } from '../../utils/verifyStripeSignature';

type StripePriceKey = 'stripe_prod_id' | 'stripe_prod_id_test';

const stripePriceKey = getPlanKey(PaymentService.STRIPE) as StripePriceKey;

export const stripeProductsWebhook = async (req: Request) => {
  const payloadBody = getStripeWebhookBody(req);
  const payload: Stripe.Event = JSON.parse(payloadBody);

  if (!shouldHandleEvent(payload)) return;

  switch (payload.type) {
    case StripeEvents.PRODUCT_UPDATED: {
      await handleProductUpdated(payload.data.object as Stripe.Product, payloadBody);
      break;
    }
    case StripeEvents.PRICE_UPDATED: {
      await handlePriceUpdated(payload.data.object as Stripe.Price, payloadBody);
      break;
    }
    default:
      log.info(`[STRIPE_WH] Unhandled event ${payload.type}, payload: ${payloadBody}`);
  }
};

async function handleProductUpdated(product: Stripe.Product, payloadBody: string) {
  log.info(`[STRIPE_WH] Updating Stripe product ${product.id}, payload: ${payloadBody}`);

  let productPrices: Stripe.Price[] = [];
  try {
    const prices = await stripeInstance.prices.list({
      product: product.id,
      limit: 100,
      active: true,
    });
    productPrices = prices.data;
  } catch (error) {
    log.error('[STRIPE_WH] Failed to list product prices', {
      productId: product.id,
      error: error instanceof Error ? error.message : error,
    });
    return;
  }

  const priceIds = productPrices.map((price) => price.id);
  if (priceIds.length === 0) {
    log.info(`[STRIPE_WH] Product ${product.id} has no active prices, skipping plan sync.`);
    return;
  }

  const plan = await prisma.plans.findFirst({
    where: {
      [stripePriceKey]: {
        in: priceIds,
      } as any,
    } as any,
  });

  if (!plan) {
    log.warn(
      `[STRIPE_WH] No internal plan linked to Stripe product ${product.id}. Prices: ${priceIds.join(', ')}`,
    );
    return;
  }

  await prisma.plans.update({
    where: { id: plan.id },
    data: {
      name: product.name,
      ...(product.description ? { description: product.description } : {}),
    },
  });
}

async function handlePriceUpdated(price: Stripe.Price, payloadBody: string) {
  log.info(`[STRIPE_WH] Updating Stripe price ${price.id}, payload: ${payloadBody}`);

  const plan = await prisma.plans.findFirst({
    where: { [stripePriceKey]: price.id } as any,
  });

  if (!plan) {
    log.warn(`[STRIPE_WH] No internal plan linked to Stripe price ${price.id}`);
    return;
  }

  await prisma.plans.update({
    where: { id: plan.id },
    data: {
      ...(price.unit_amount != null ? { price: price.unit_amount / 100 } : {}),
    },
  });
}

const shouldHandleEvent = (payload: Stripe.Event): boolean => {
  switch (payload.type) {
    case StripeEvents.PRODUCT_UPDATED:
    case StripeEvents.PRICE_UPDATED:
      return true;
    default:
      log.info(`[STRIPE_WH] Unhandled event ${payload.type}, payload: ${JSON.stringify(payload)}`);
      return false;
  }
};
