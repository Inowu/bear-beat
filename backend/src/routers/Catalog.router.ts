import { publicProcedure } from '../procedures/public.procedure';
import { router } from '../trpc';
import { log } from '../server';
import { getCatalogStats, type CatalogStatsResult } from './file-actions/catalog-stats';

export type PublicCatalogSummary = CatalogStatsResult & {
  generatedAt: string;
  /** True when the snapshot is older than the TTL and a refresh is happening in the background. */
  stale: boolean;
};

const CATALOG_SUMMARY_TTL_MS = 24 * 60 * 60 * 1000;
let cached: PublicCatalogSummary | null = null;
let cachedAt = 0;
let inFlight: Promise<PublicCatalogSummary> | null = null;

const refreshCatalogSummary = async (): Promise<PublicCatalogSummary> => {
  if (inFlight) return inFlight;

  inFlight = (async () => {
    const startedAt = Date.now();
    const result = await getCatalogStats();

    const snapshot: PublicCatalogSummary = {
      ...result,
      generatedAt: new Date().toISOString(),
      stale: false,
    };

    if (snapshot.error) {
      // Keep last known good snapshot when a refresh fails.
      log.warn(`[CATALOG_SUMMARY] Refresh failed: ${snapshot.error}`);
      if (cached) {
        return { ...cached, stale: true };
      }
      return snapshot;
    }

    cached = snapshot;
    cachedAt = Date.now();

    log.info(
      `[CATALOG_SUMMARY] Refreshed in ${Date.now() - startedAt}ms, files=${snapshot.totalFiles}, gb=${snapshot.totalGB}`,
    );

    return snapshot;
  })().finally(() => {
    inFlight = null;
  });

  return inFlight;
};

export const catalogRouter = router({
  /**
   * Public catalog snapshot for the landing page.
   * Uses a long TTL + singleflight refresh to avoid heavy scans per visitor.
   */
  getPublicCatalogSummary: publicProcedure.query(async () => {
    const now = Date.now();
    const isFresh = cached && now - cachedAt < CATALOG_SUMMARY_TTL_MS;

    if (isFresh) {
      return { ...cached, stale: false };
    }

    // Stale-while-revalidate: return stale immediately, refresh in the background.
    if (cached) {
      void refreshCatalogSummary();
      return { ...cached, stale: true };
    }

    // First request: compute once, then cache.
    return refreshCatalogSummary();
  }),
});

