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

export const verifyStripeSignatureAny = (
  req: Request,
  secrets: Array<string | undefined | null>,
): boolean => {
  const sig = req.headers['stripe-signature'];
  if (!sig) return false;

  let lastErr: unknown = null;
  for (const candidate of secrets) {
    const secret = typeof candidate === 'string' ? candidate.trim() : '';
    if (!secret) continue;
    try {
      stripeInstance.webhooks.constructEvent(req.body as Buffer | string, sig, secret);
      return true;
    } catch (err) {
      lastErr = err;
    }
  }

  if (lastErr) {
    log.error(`[STRIPE_WH] Error verifying signature: ${lastErr}`);
  }
  return false;
};
