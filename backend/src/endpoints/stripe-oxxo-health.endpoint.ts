import { Request, Response } from 'express';
import stripeOxxoInstance, { isStripeOxxoConfigured } from '../stripe/oxxo';
import { log } from '../server';

type StripeErrorShape = {
  type?: unknown;
  code?: unknown;
  statusCode?: unknown;
  requestId?: unknown;
  message?: unknown;
};

const toSafeString = (value: unknown, maxLen = 180): string | null => {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLen);
};

const sanitizeStripeError = (err: unknown) => {
  const e = err as StripeErrorShape;
  return {
    type: toSafeString(e?.type),
    code: toSafeString(e?.code),
    statusCode: typeof e?.statusCode === 'number' ? e.statusCode : null,
    requestId: toSafeString(e?.requestId, 80),
    message: toSafeString(e?.message),
  };
};

/**
 * Minimal production health probe for the separate Stripe account used for OXXO.
 * This endpoint is intentionally non-sensitive: it only returns booleans + safe error codes.
 */
export const stripeOxxoHealthEndpoint = async (_req: Request, res: Response) => {
  const configured = isStripeOxxoConfigured();

  if (!configured) {
    return res.json({
      ok: false,
      configured: false,
      chargesEnabled: null,
      payoutsEnabled: null,
      detailsSubmitted: null,
      country: null,
      defaultCurrency: null,
      error: null,
    });
  }

  try {
    // Prefer /v1/account (current account) to expose basic readiness booleans.
    const account: any = await stripeOxxoInstance.accounts.retrieve();
    return res.json({
      ok: true,
      configured: true,
      chargesEnabled:
        typeof account?.charges_enabled === 'boolean' ? account.charges_enabled : null,
      payoutsEnabled:
        typeof account?.payouts_enabled === 'boolean' ? account.payouts_enabled : null,
      detailsSubmitted:
        typeof account?.details_submitted === 'boolean' ? account.details_submitted : null,
      country: toSafeString(account?.country, 12),
      defaultCurrency: toSafeString(account?.default_currency, 12),
      error: null,
    });
  } catch (err) {
    const error = sanitizeStripeError(err);
    log.error('[HEALTH] Stripe OXXO account probe failed', error);

    // Still return 200 so it can be used as a quick probe without triggering monitoring noise.
    return res.json({
      ok: false,
      configured: true,
      chargesEnabled: null,
      payoutsEnabled: null,
      detailsSubmitted: null,
      country: null,
      defaultCurrency: null,
      error,
    });
  }
};

