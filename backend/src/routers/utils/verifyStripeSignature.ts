import type { Request } from 'express';
import stripeInstance from '../../stripe';
import { log } from '../../server';

export const verifyStripeSignature = (req: Request, secret: string) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return false;
  }

  try {
    stripeInstance.webhooks.constructEvent(req.body as any, sig, secret);

    return true;
  } catch (err) {
    log.error(`[STRIPE_WH] Error verifying signature: ${err}`);
    return false;
  }
};
