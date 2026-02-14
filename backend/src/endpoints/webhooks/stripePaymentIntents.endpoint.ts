import { Request, Response } from 'express';
import { verifyStripeSignatureAny } from '../../routers/utils/verifyStripeSignature';
import { log } from '../../server';
import { stripeInvoiceWebhook } from '../../routers/webhooks/stripe/paymentIntentsWh';

export const stripePiEndpoint = async (req: Request, res: Response) => {
  const isValid = verifyStripeSignatureAny(req, [
    process.env.STRIPE_WH_PI_SECRET,
    process.env.STRIPE_OXXO_WH_PI_SECRET,
  ]);

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
