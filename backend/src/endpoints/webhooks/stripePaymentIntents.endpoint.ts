import { Request, Response } from 'express';
import { verifyStripeSignatureAny } from '../../routers/utils/verifyStripeSignature';
import { receiveWebhookIntoInbox } from './webhookInboxReception';

export const stripePiEndpoint = async (req: Request, res: Response) => {
  const isValid = verifyStripeSignatureAny(req, [
    process.env.STRIPE_WH_PI_SECRET,
    process.env.STRIPE_OXXO_WH_PI_SECRET,
  ]);

  if (!isValid) {
    return res.status(400).send('Invalid signature');
  }

  const result = await receiveWebhookIntoInbox({
    provider: 'stripe_pi',
    req,
    logPrefix: 'STRIPE_PI_WH',
  });
  if (!result.ok) {
    return res.status(result.status).send(result.message);
  }

  return res.status(200).end();
};
