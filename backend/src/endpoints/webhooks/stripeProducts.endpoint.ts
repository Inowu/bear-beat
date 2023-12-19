import { Request, Response } from 'express';
import { verifyStripeSignature } from '../../routers/utils/verifyStripeSignature';
import { log } from '../../server';
import { stripeProductsWebhook } from '../../routers/webhooks/stripe/productsWh';

export const stripeProductsEndpoint = async (req: Request, res: Response) => {
  const isValid = verifyStripeSignature(
    req,
    process.env.STRIPE_WH_PI_SECRET as string,
  );

  if (!isValid) {
    return res.status(400).send('Invalid signature');
  }

  try {
    await stripeProductsWebhook(req);

    return res.status(200).end();
  } catch (e) {
    log.error(`[STRIPE_WH] Error handling webhook: ${e}`);

    return res.status(500).end();
  }
};
