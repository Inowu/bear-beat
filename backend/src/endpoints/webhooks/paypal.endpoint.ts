import { Request, Response } from 'express';
import { verifyPaypalSignature } from '../../routers/utils/verifyPaypalSignature';
import { receiveWebhookIntoInbox } from './webhookInboxReception';

export const paypalEndpoint = async (req: Request, res: Response) => {
  const isValid = await verifyPaypalSignature(req);
  if (!isValid) {
    return res.status(400).send('Invalid signature');
  }

  const result = await receiveWebhookIntoInbox({
    provider: 'paypal',
    req,
    logPrefix: 'PAYPAL_WH',
  });
  if (!result.ok) {
    return res.status(result.status).send(result.message);
  }

  return res.status(200).end();
};
