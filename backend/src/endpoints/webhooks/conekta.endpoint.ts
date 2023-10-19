import { Request, Response } from 'express';
import { conektaSubscriptionWebhook } from '../../routers/webhooks/conekta';
import { log } from '../../server';

export const conektaEndpoint = async (req: Request, res: Response) => {
  // TODO: Uncomment this when conekta signature verification is fixed
  // const isValid = verifyConektaSignature(req, req.body);
  //
  // if (!isValid) return res.status(401).send('Invalid signature');

  try {
    await conektaSubscriptionWebhook(req);

    return res.status(200).end();
  } catch (e) {
    log.error(`[CONEKTA_WH] Error handling webhook: ${e}`);
    return res.status(500).end();
  }
};
