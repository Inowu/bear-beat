import { Request, Response } from 'express';
import { paypalSubscriptionWebhook } from '../../routers/webhooks/paypal';
import { log } from '../../server';

export const paypalEndpoint = async (req: Request, res: Response) => {
  // const isValid = await verifyPaypalSignature(req);

  // if (!isValid) {
  //   return res.status(400).send('Invalid signature');
  // }

  try {
    await paypalSubscriptionWebhook(req);

    return res.status(200).end();
  } catch (e) {
    log.error(`[PAYPAL_WH] Error handling webhook: ${e}`);
    return res.status(200).end();
  }
};
