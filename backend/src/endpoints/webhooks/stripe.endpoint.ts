import { Request, Response } from 'express';
import { verifyStripeSignature } from '../../routers/utils/verifyStripeSignature';
import { receiveWebhookIntoInbox } from './webhookInboxReception';

export const stripeEndpoint = async (req: Request, res: Response) => {
  const isValid = verifyStripeSignature(
    req,
    process.env.STRIPE_WH_SECRET as string,
  );

  if (!isValid) {
    return res.status(400).send('Invalid signature');
  }

  const result = await receiveWebhookIntoInbox({
    provider: 'stripe',
    req,
    logPrefix: 'STRIPE_WH',
  });
  if (!result.ok) {
    return res.status(result.status).send(result.message);
  }

  return res.status(200).end();
};
