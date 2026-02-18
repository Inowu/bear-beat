import { Request, Response } from 'express';
import { verifyStripeSignature } from '../../routers/utils/verifyStripeSignature';
import { receiveWebhookIntoInbox } from './webhookInboxReception';

export const stripeProductsEndpoint = async (req: Request, res: Response) => {
  const productsSecret =
    process.env.STRIPE_WH_PRODUCTS_SECRET || process.env.STRIPE_WH_PI_SECRET;

  const isValid = verifyStripeSignature(
    req,
    productsSecret as string,
  );

  if (!isValid) {
    return res.status(400).send('Invalid signature');
  }

  const result = await receiveWebhookIntoInbox({
    provider: 'stripe_products',
    req,
    logPrefix: 'STRIPE_PRODUCTS_WH',
  });
  if (!result.ok) {
    return res.status(result.status).send(result.message);
  }

  return res.status(200).end();
};
