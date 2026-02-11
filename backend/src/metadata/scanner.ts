import fs from 'fs/promises';
import type { Dirent } from 'fs';
import path from 'path';
import { prisma } from '../db';
import { log } from '../server';
import {
  inferTrackMetadataFromName,
  toCatalogRelativePath,
} from './inferTrackMetadata';
import { backfillSpotifyCoversForCatalog, toTrackMetadataCreateInput } from './store';
import { isSpotifyMetadataEnabled } from '../spotify';

const DEFAULT_CHUNK_SIZE = 500;

export type TrackMetadataScanOptions = {
  songsPath?: string;
  chunkSize?: number;
  clearBeforeInsert?: boolean;
  spotifyCovers?: boolean;
  spotifyCoverMax?: number;
  logger?: Pick<typeof log, 'info' | 'warn' | 'error'>;
};

export type TrackMetadataScanResult = {
  songsPath: string;
  scannedFiles: number;
  indexedTracks: number;
  skippedFiles: number;
  spotifyCoversProcessed: number;
  spotifyCoversUpdated: number;
  spotifyCoversMisses: number;
  durationMs: number;
};

async function flushBatch(
  batch: Array<ReturnType<typeof toTrackMetadataCreateInput>>,
): Promise<number> {
  if (!batch.length) return 0;
  const result = await prisma.trackMetadata.createMany({
    data: batch,
    skipDuplicates: true,
  });
  batch.length = 0;
  return result.count;
}

async function walkDir(
  rootPath: string,
  currentDir: string,
  onFile: (absoluteFilePath: string, fileName: string) => Promise<void>,
): Promise<void> {
  let entries: Dirent[];
  try {
    entries = await fs.readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const absoluteEntryPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      await walkDir(rootPath, absoluteEntryPath, onFile);
      continue;
    }

    if (entry.isFile()) {
      await onFile(absoluteEntryPath, entry.name);
    }
  }
}

export async function rebuildTrackMetadataIndex(
  options: TrackMetadataScanOptions = {},
): Promise<TrackMetadataScanResult> {
  const songsPath = options.songsPath ?? process.env.SONGS_PATH;
  if (!songsPath) {
    throw new Error('SONGS_PATH no configurado');
  }

  const logger = options.logger ?? log;
  const chunkSize = Math.max(50, options.chunkSize ?? DEFAULT_CHUNK_SIZE);
  const clearBeforeInsert = options.clearBeforeInsert ?? true;
  const spotifyCoversEnabled =
    options.spotifyCovers ?? (process.env.TRACK_METADATA_SPOTIFY_SCAN_ON_REBUILD === '1');
  const spotifyCoverMax = Number.isFinite(options.spotifyCoverMax as number)
    ? Math.max(1, Math.floor(options.spotifyCoverMax as number))
    : Number(process.env.TRACK_METADATA_SPOTIFY_SCAN_MAX ?? 400);
  const startedAt = Date.now();
  const batch: Array<ReturnType<typeof toTrackMetadataCreateInput>> = [];
  let scannedFiles = 0;
  let indexedTracks = 0;
  let skippedFiles = 0;

  logger.info(`[TRACK_METADATA] Starting scan at ${songsPath}`);

  if (clearBeforeInsert) {
    await prisma.trackMetadata.deleteMany({});
  }

  await walkDir(songsPath, songsPath, async (absoluteFilePath, fileName) => {
    scannedFiles += 1;
    const inferred = inferTrackMetadataFromName(fileName);
    if (!inferred) {
      skippedFiles += 1;
      return;
    }

    const relativePath = toCatalogRelativePath(absoluteFilePath, songsPath);
    batch.push(toTrackMetadataCreateInput(relativePath, fileName, inferred));

    if (batch.length >= chunkSize) {
      indexedTracks += await flushBatch(batch);
    }
  });

  indexedTracks += await flushBatch(batch);

  let spotifyCoversProcessed = 0;
  let spotifyCoversUpdated = 0;
  let spotifyCoversMisses = 0;

  if (spotifyCoversEnabled && isSpotifyMetadataEnabled()) {
    const result = await backfillSpotifyCoversForCatalog({ maxToProcess: spotifyCoverMax });
    spotifyCoversProcessed = result.processed;
    spotifyCoversUpdated = result.updated;
    spotifyCoversMisses = result.misses;
  }

  const durationMs = Date.now() - startedAt;
  logger.info(
    `[TRACK_METADATA] Scan finished: files=${scannedFiles}, indexed=${indexedTracks}, skipped=${skippedFiles}, durationMs=${durationMs}`,
  );

  return {
    songsPath,
    scannedFiles,
    indexedTracks,
    skippedFiles,
    spotifyCoversProcessed,
    spotifyCoversUpdated,
    spotifyCoversMisses,
    durationMs,
  };
}
