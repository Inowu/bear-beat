import { Request, Response } from 'express';
import { paypalSubscriptionWebhook } from '../../routers/webhooks/paypal';
import { log } from '../../server';
import { verifyPaypalSignature } from '../../routers/utils/verifyPaypalSignature';

export const paypalEndpoint = async (req: Request, res: Response) => {
  const isValid = await verifyPaypalSignature(req);
  if (!isValid) {
    return res.status(400).send('Invalid signature');
  }

  try {
    await paypalSubscriptionWebhook(req);

    return res.status(200).end();
  } catch (e) {
    log.error(`[PAYPAL_WH] Error handling webhook: ${e}`);
    // Return non-2xx so PayPal can retry on transient failures.
    return res.status(500).end();
  }
};
