import crypto from 'crypto';

const DEFAULT_PUBLIC_API_URL = 'https://thebearbeatapi.lat';

const resolvePublicApiUrl = (): string => {
  const raw =
    (process.env.PUBLIC_API_URL || '').trim()
    || (process.env.PAYPAL_WEBHOOK_BASE_URL || '').trim()
    || DEFAULT_PUBLIC_API_URL;

  return raw.replace(/\/+$/, '');
};

const resolveSecret = (): string | null => {
  const secret = (process.env.EMAIL_PREFERENCES_SECRET || '').trim();
  return secret ? secret : null;
};

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i += 1) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}

const signValue = (value: string, secret: string): string =>
  crypto.createHmac('sha256', secret).update(value).digest('hex');

export function signMarketingUnsubscribe(userId: number): string | null {
  const secret = resolveSecret();
  if (!secret) return null;
  return signValue(`marketing-email:${userId}`, secret);
}

export function verifyMarketingUnsubscribe(userId: number, sig: string): boolean {
  const expected = signMarketingUnsubscribe(userId);
  if (!expected) return false;
  const provided = `${sig ?? ''}`.trim();
  if (!provided) return false;
  return safeEqual(expected, provided);
}

export function buildMarketingUnsubscribeUrl(userId: number): string | null {
  const sig = signMarketingUnsubscribe(userId);
  if (!sig) return null;
  const base = resolvePublicApiUrl();
  return `${base}/api/comms/unsubscribe?u=${encodeURIComponent(String(userId))}&sig=${encodeURIComponent(sig)}`;
}
