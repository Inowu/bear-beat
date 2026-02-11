import './_loadEnv';
import { prisma } from '../src/db';
import { rebuildTrackMetadataIndex } from '../src/metadata';

async function main() {
  const chunkSizeRaw = Number(process.env.TRACK_METADATA_SCAN_CHUNK_SIZE ?? 500);
  const chunkSize = Number.isFinite(chunkSizeRaw) && chunkSizeRaw > 0 ? chunkSizeRaw : 500;
  const spotifyCoverMaxRaw = Number(process.env.TRACK_METADATA_SPOTIFY_SCAN_MAX ?? 400);
  const spotifyCoverMax =
    Number.isFinite(spotifyCoverMaxRaw) && spotifyCoverMaxRaw > 0
      ? Math.floor(spotifyCoverMaxRaw)
      : 400;
  const result = await rebuildTrackMetadataIndex({
    chunkSize,
    clearBeforeInsert: true,
    spotifyCovers: process.env.TRACK_METADATA_SPOTIFY_SCAN_ON_REBUILD === '1',
    spotifyCoverMax,
  });

  console.log('[TRACK_METADATA] Scan complete');
  console.log(`  songsPath: ${result.songsPath}`);
  console.log(`  scannedFiles: ${result.scannedFiles}`);
  console.log(`  indexedTracks: ${result.indexedTracks}`);
  console.log(`  skippedFiles: ${result.skippedFiles}`);
  console.log(`  spotifyCoversProcessed: ${result.spotifyCoversProcessed}`);
  console.log(`  spotifyCoversUpdated: ${result.spotifyCoversUpdated}`);
  console.log(`  spotifyCoversMisses: ${result.spotifyCoversMisses}`);
  console.log(`  durationMs: ${result.durationMs}`);
}

main()
  .catch((error) => {
    console.error(`[TRACK_METADATA] Scan failed: ${error?.message ?? error}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => null);
  });
