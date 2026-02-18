import { Request, Response } from 'express';
import { verifyConektaSignature } from '../../routers/utils/verifyConektaSignature';
import { receiveWebhookIntoInbox } from './webhookInboxReception';

export const conektaEndpoint = async (req: Request, res: Response) => {
  const isValid = verifyConektaSignature(req);
  if (!isValid) {
    return res.status(400).send('Invalid signature');
  }

  const result = await receiveWebhookIntoInbox({
    provider: 'conekta',
    req,
    logPrefix: 'CONEKTA_WH',
  });
  if (!result.ok) {
    return res.status(result.status).send(result.message);
  }

  return res.status(200).end();
};
