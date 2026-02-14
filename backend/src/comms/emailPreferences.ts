export type EmailMarketingCategoryPrefs = {
  news: boolean;
  offers: boolean;
  digest: boolean;
};

export type EmailMarketingPrefsPatch = Partial<EmailMarketingCategoryPrefs> & {
  enabled?: boolean;
};

export const computeEmailMarketingEnabled = (prefs: EmailMarketingCategoryPrefs): boolean =>
  Boolean(prefs.news || prefs.offers || prefs.digest);

const hasAnyCategoryPatch = (patch: EmailMarketingPrefsPatch): boolean =>
  patch.news !== undefined || patch.offers !== undefined || patch.digest !== undefined;

/**
 * Apply a marketing-preferences patch while keeping the legacy/global switch in sync.
 *
 * Rules:
 * - `enabled=false` is a hard off: all categories disabled.
 * - `enabled=true` with no category flags provided enables all categories (conversion-first).
 * - Otherwise, categories are updated as provided and `enabled` becomes OR(categories).
 */
export function applyEmailMarketingPrefsPatch(
  current: EmailMarketingCategoryPrefs,
  patch: EmailMarketingPrefsPatch,
): { next: EmailMarketingCategoryPrefs; enabled: boolean } {
  if (patch.enabled === false) {
    return { next: { news: false, offers: false, digest: false }, enabled: false };
  }

  let next: EmailMarketingCategoryPrefs = { ...current };
  if (patch.news !== undefined) next.news = Boolean(patch.news);
  if (patch.offers !== undefined) next.offers = Boolean(patch.offers);
  if (patch.digest !== undefined) next.digest = Boolean(patch.digest);

  let enabled = computeEmailMarketingEnabled(next);

  if (patch.enabled === true) {
    const patchedCategories = hasAnyCategoryPatch(patch);
    if (!patchedCategories && !enabled) {
      next = { news: true, offers: true, digest: true };
      enabled = true;
    }
  }

  return { next, enabled };
}

