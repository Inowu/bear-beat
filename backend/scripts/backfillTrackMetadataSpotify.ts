import './_loadEnv';
import { prisma } from '../src/db';
import { backfillSpotifyCoversForCatalog } from '../src/metadata';
import { isSpotifyMetadataEnabled } from '../src/spotify';

async function main() {
  if (!isSpotifyMetadataEnabled()) {
    console.log('[TRACK_METADATA] Spotify cover backfill skipped (TRACK_METADATA_SPOTIFY_ENABLED!=1 or credentials missing).');
    return;
  }

  const maxRaw = Number(process.env.TRACK_METADATA_SPOTIFY_SCAN_MAX ?? 0);
  const maxToProcess = Number.isFinite(maxRaw) && maxRaw > 0 ? Math.floor(maxRaw) : undefined;
  const result = await backfillSpotifyCoversForCatalog({ maxToProcess });

  console.log('[TRACK_METADATA] Spotify cover backfill complete');
  console.log(`  processed: ${result.processed}`);
  console.log(`  updated: ${result.updated}`);
  console.log(`  misses: ${result.misses}`);
}

main()
  .catch((error) => {
    console.error(`[TRACK_METADATA] Spotify cover backfill failed: ${error?.message ?? error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
