import { computeDunningStageDays } from '../src/billing/dunning';
import { buildStripeBillingPortalUrl, verifyStripeBillingPortalToken } from '../src/billing/stripeBillingPortalLink';

describe('billing dunning', () => {
  test('computeDunningStageDays returns expected stage', () => {
    const now = new Date('2026-02-14T00:00:00.000Z');

    expect(computeDunningStageDays(new Date('2026-02-14T00:00:00.000Z'), now)).toBe(0);
    expect(computeDunningStageDays(new Date('2026-02-13T23:59:59.000Z'), now)).toBe(0);

    expect(computeDunningStageDays(new Date('2026-02-13T00:00:00.000Z'), now)).toBe(1);
    expect(computeDunningStageDays(new Date('2026-02-12T00:00:00.000Z'), now)).toBe(1);

    expect(computeDunningStageDays(new Date('2026-02-11T00:00:00.000Z'), now)).toBe(3);
    expect(computeDunningStageDays(new Date('2026-02-07T00:00:00.000Z'), now)).toBe(7);
    expect(computeDunningStageDays(new Date('2026-01-31T00:00:00.000Z'), now)).toBe(14);
  });

  test('computeDunningStageDays returns null for future timestamps', () => {
    const now = new Date('2026-02-14T00:00:00.000Z');
    expect(computeDunningStageDays(new Date('2026-02-14T00:00:01.000Z'), now)).toBe(null);
  });
});

describe('stripe billing portal link', () => {
  test('buildStripeBillingPortalUrl generates a verifiable token url', () => {
    const prevLinksSecret = process.env.EMAIL_LINKS_SECRET;
    const prevPrefsSecret = process.env.EMAIL_PREFERENCES_SECRET;
    const prevPublicApi = process.env.PUBLIC_API_URL;

    process.env.EMAIL_LINKS_SECRET = 'test-links-secret';
    process.env.EMAIL_PREFERENCES_SECRET = '';
    process.env.PUBLIC_API_URL = 'https://api.example.test';

    const url = buildStripeBillingPortalUrl({ userId: 123, ttlDays: 2 });
    expect(url).toBeTruthy();

    const parsed = new URL(url!);
    expect(parsed.origin).toBe('https://api.example.test');
    expect(parsed.pathname).toBe('/api/billing/portal');

    const token = parsed.searchParams.get('token');
    expect(token).toBeTruthy();

    expect(verifyStripeBillingPortalToken(token!)).toBe(123);

    // Wrong secret should fail verification.
    process.env.EMAIL_LINKS_SECRET = 'different-secret';
    expect(verifyStripeBillingPortalToken(token!)).toBe(null);

    process.env.EMAIL_LINKS_SECRET = prevLinksSecret;
    process.env.EMAIL_PREFERENCES_SECRET = prevPrefsSecret;
    process.env.PUBLIC_API_URL = prevPublicApi;
  });
});
