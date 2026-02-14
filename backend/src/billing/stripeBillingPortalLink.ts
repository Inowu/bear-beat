import jwt from 'jsonwebtoken';

const DEFAULT_TTL_DAYS = 21;

const resolveSecret = (): string | null => {
  const primary = String(process.env.EMAIL_LINKS_SECRET || '').trim();
  if (primary) return primary;
  // Backward-compatible fallback: reuse preferences secret if links secret isn't set.
  const fallback = String(process.env.EMAIL_PREFERENCES_SECRET || '').trim();
  return fallback || null;
};

const resolvePublicApiUrl = (): string => {
  const raw =
    String(process.env.PUBLIC_API_URL || '').trim()
    || String(process.env.PAYPAL_WEBHOOK_BASE_URL || '').trim()
    || 'https://thebearbeatapi.lat';
  return raw.replace(/\/+$/, '');
};

type BillingPortalTokenPayload = {
  // Purpose guard.
  p: 'stripe_billing_portal';
  // User id (internal).
  u: number;
};

export const buildStripeBillingPortalUrl = (params: {
  userId: number;
  ttlDays?: number;
}): string | null => {
  const { userId, ttlDays } = params;
  const secret = resolveSecret();
  if (!secret) return null;

  const safeTtlDays = Math.max(1, Math.min(60, Math.floor(ttlDays ?? DEFAULT_TTL_DAYS)));
  const token = jwt.sign(
    { p: 'stripe_billing_portal', u: userId } satisfies BillingPortalTokenPayload,
    secret,
    { expiresIn: `${safeTtlDays}d` },
  );

  const base = resolvePublicApiUrl();
  return `${base}/api/billing/portal?token=${encodeURIComponent(token)}`;
};

export const verifyStripeBillingPortalToken = (token: string): number | null => {
  const secret = resolveSecret();
  if (!secret) return null;

  try {
    const decoded = jwt.verify(token, secret) as Partial<BillingPortalTokenPayload>;
    if (decoded?.p !== 'stripe_billing_portal') return null;
    const userId = Number(decoded?.u);
    if (!Number.isFinite(userId) || userId <= 0) return null;
    return Math.trunc(userId);
  } catch {
    return null;
  }
};

