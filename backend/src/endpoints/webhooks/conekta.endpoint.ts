import { Request, Response } from 'express';
import { conektaSubscriptionWebhook } from '../../routers/webhooks/conekta';
import { log } from '../../server';
import { verifyConektaSignature } from '../../routers/utils/verifyConektaSignature';

export const conektaEndpoint = async (req: Request, res: Response) => {
  const isValid = verifyConektaSignature(req);
  if (!isValid) {
    return res.status(400).send('Invalid signature');
  }

  try {
    await conektaSubscriptionWebhook(req);

    return res.status(200).end();
  } catch (e) {
    if (e instanceof SyntaxError) {
      log.warn('[CONEKTA_WH] Invalid JSON payload');
      return res.status(400).send('Invalid JSON payload');
    }

    log.error(`[CONEKTA_WH] Error handling webhook: ${e}`);
    return res.status(500).end();
  }
};
