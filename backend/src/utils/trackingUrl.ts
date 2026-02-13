const MAX_TRACKING_URL_LENGTH = 1000;

// Parameters we should not forward to third-party trackers.
// This keeps CAPI clean and prevents leaking internal tokens.
const TRACKING_URL_PARAM_DENYLIST = new Set([
  // ManyChat / internal handoff tokens.
  'mcp_token',
  'mc_t',
  // Common click ids (already covered via _fbc/_fbp).
  'fbclid',
  'gclid',
  'ttclid',
  // Stripe/session identifiers are not needed in event_source_url.
  'session_id',
  'sessionId',
]);

export function sanitizeTrackingUrl(input: string, maxLen = MAX_TRACKING_URL_LENGTH): string {
  const raw = `${input ?? ''}`.trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    for (const key of TRACKING_URL_PARAM_DENYLIST) {
      url.searchParams.delete(key);
    }
    const cleaned = url.toString();
    return cleaned.length > maxLen ? cleaned.slice(0, maxLen) : cleaned;
  } catch {
    return raw.length > maxLen ? raw.slice(0, maxLen) : raw;
  }
}

