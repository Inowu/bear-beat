import type { Request } from 'express';
import stripeInstance from '../../stripe';
import { log } from '../../server';

/**
 * Devuelve el body del webhook como string para parsear.
 * Con express.raw() el body es Buffer; la verificación de firma debe usar el body crudo (Buffer/string).
 */
export function getStripeWebhookBody(req: Request): string {
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (typeof req.body === 'string') return req.body;
  return '';
}

export const verifyStripeSignature = (req: Request, secret: string) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return false;
  }

  try {
    stripeInstance.webhooks.constructEvent(req.body as Buffer | string, sig, secret);

    return true;
  } catch (err) {
    log.error(`[STRIPE_WH] Error verifying signature: ${err}`);
    return false;
  }
};
