import { Request, Response } from 'express';
import { verifyStripeSignature } from '../../routers/utils/verifyStripeSignature';
import { log } from '../../server';
import { stripeInvoiceWebhook } from '../../routers/webhooks/stripe/paymentIntentsWh';

export const stripePiEndpoint = async (req: Request, res: Response) => {
  const isValid = verifyStripeSignature(req);

  if (!isValid) {
    return res.status(400).send('Invalid signature');
  }

  try {
    await stripeInvoiceWebhook(req);

    return res.status(200).end();
  } catch (e) {
    log.error(`[STRIPE_WH] Error handling webhook: ${e}`);

    return res.status(500).end();
  }
};
