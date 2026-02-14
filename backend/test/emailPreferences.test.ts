import { applyEmailMarketingPrefsPatch } from '../src/comms/emailPreferences';

describe('applyEmailMarketingPrefsPatch', () => {
  test('enabled=false hard-disables all categories', () => {
    const { next, enabled } = applyEmailMarketingPrefsPatch(
      { news: true, offers: true, digest: true },
      { enabled: false },
    );
    expect(enabled).toBe(false);
    expect(next).toEqual({ news: false, offers: false, digest: false });
  });

  test('enabled=true with no category patch enables all when currently all-off', () => {
    const { next, enabled } = applyEmailMarketingPrefsPatch(
      { news: false, offers: false, digest: false },
      { enabled: true },
    );
    expect(enabled).toBe(true);
    expect(next).toEqual({ news: true, offers: true, digest: true });
  });

  test('category patches are applied and enabled is OR(categories)', () => {
    const { next, enabled } = applyEmailMarketingPrefsPatch(
      { news: true, offers: true, digest: false },
      { news: false },
    );
    expect(next).toEqual({ news: false, offers: true, digest: false });
    expect(enabled).toBe(true);
  });

  test('disabling the last true category turns enabled=false', () => {
    const { next, enabled } = applyEmailMarketingPrefsPatch(
      { news: false, offers: true, digest: false },
      { offers: false },
    );
    expect(next).toEqual({ news: false, offers: false, digest: false });
    expect(enabled).toBe(false);
  });
});

