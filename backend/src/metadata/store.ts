import { Prisma, TrackMetadata } from '@prisma/client';
import path from 'path';
import { prisma } from '../db';
import { IFileStat } from '../services/interfaces/fileService.interface';
import { log } from '../server';
import {
  isSpotifyMetadataEnabled,
  isSpotifyRateLimitError,
  searchSpotifyTrackMetadata,
  type SpotifyTrackMetadataResult,
} from '../spotify';
import {
  InferredTrackMetadata,
  inferTrackMetadataFromName,
  normalizeCatalogPath,
} from './inferTrackMetadata';
import { getEmbeddedTrackTags } from './embeddedTags';

const TRACK_METADATA_QUERY_BATCH = 400;
const SPOTIFY_MISS_RETRY_HOURS = Number(process.env.TRACK_METADATA_SPOTIFY_MISS_RETRY_HOURS ?? 24);
const SPOTIFY_MISS_RETRY_MINUTES_ON_READ = Number(
  process.env.TRACK_METADATA_SPOTIFY_MISS_RETRY_MINUTES_ON_READ ?? 15,
);
const SPOTIFY_DEFAULT_MAX_PER_CALL = Number(process.env.TRACK_METADATA_SPOTIFY_MAX_PER_CALL ?? 6);
const SPOTIFY_SYNC_ON_READ_ENABLED = process.env.TRACK_METADATA_SPOTIFY_SYNC_ON_READ !== '0';
const SPOTIFY_SYNC_ON_READ_MAX_PER_CALL = Number(
  process.env.TRACK_METADATA_SPOTIFY_SYNC_ON_READ_MAX_PER_CALL ?? 6,
);
const SPOTIFY_SAFE_MAX_PER_CALL = Number(process.env.TRACK_METADATA_SPOTIFY_SAFE_MAX_PER_CALL ?? 2);
const SPOTIFY_TEXT_METADATA_MIN_CONFIDENCE = Number(
  process.env.TRACK_METADATA_SPOTIFY_TEXT_MIN_CONFIDENCE ?? 0.58,
);
const TRACK_METADATA_SYNC_COOLDOWN_MS = Number(process.env.TRACK_METADATA_SYNC_COOLDOWN_MS ?? 5 * 60 * 1000);
const TRACK_METADATA_SYNC_MAX_FILES_PER_CALL = Number(
  process.env.TRACK_METADATA_SYNC_MAX_FILES_PER_CALL ?? 180,
);
const TRACK_METADATA_SYNC_RECENT_CACHE_MAX_ENTRIES = Number(
  process.env.TRACK_METADATA_SYNC_RECENT_CACHE_MAX_ENTRIES ?? 12_000,
);

const trackMetadataSyncInFlightPaths = new Set<string>();
const trackMetadataSyncRecentlyQueuedAt = new Map<string, number>();

const trackMetadataSelect = {
  path: true,
  artist: true,
  title: true,
  displayName: true,
  bpm: true,
  camelot: true,
  energyLevel: true,
  format: true,
  version: true,
  coverUrl: true,
  durationSeconds: true,
  source: true,
} as const;

type SelectedTrackMetadata = Pick<
  TrackMetadata,
  'path' |
  'artist' |
  'title' |
  'displayName' |
  'bpm' |
  'camelot' |
  'energyLevel' |
  'format' |
  'version' |
  'coverUrl' |
  'durationSeconds' |
  'source'
>;

export type TrackMetadataView = {
  artist: string | null;
  title: string | null;
  displayName: string | null;
  bpm: number | null;
  camelot: string | null;
  energyLevel: number | null;
  format: string | null;
  version: string | null;
  coverUrl: string | null;
  durationSeconds: number | null;
  source: 'database' | 'inferred';
};

export type SearchDocument = Record<string, any>;
type SpotifyBackfillCandidate = {
  id: number;
  path: string;
  name: string;
  artist: string | null;
  title: string | null;
  displayName: string | null;
  source: string;
};

function normalizeText(value: unknown): string | null {
  const text = `${value ?? ''}`.trim();
  return text ? text : null;
}

function toTrackMetadataView(record: SelectedTrackMetadata): TrackMetadataView {
  return {
    artist: normalizeText(record.artist),
    title: normalizeText(record.title),
    displayName: normalizeText(record.displayName),
    bpm: typeof record.bpm === 'number' && Number.isFinite(record.bpm) ? record.bpm : null,
    camelot: normalizeText(record.camelot),
    energyLevel:
      typeof record.energyLevel === 'number' && Number.isFinite(record.energyLevel)
        ? record.energyLevel
        : null,
    format: normalizeText(record.format),
    version: normalizeText(record.version),
    coverUrl: normalizeText(record.coverUrl),
    durationSeconds:
      typeof record.durationSeconds === 'number' && Number.isFinite(record.durationSeconds)
        ? record.durationSeconds
        : null,
    source: 'database',
  };
}

export function resolveChildCatalogPath(basePath: string, fileName: string): string {
  const normalizedBase = normalizeCatalogPath(basePath || '/');
  const normalizedName = `${fileName ?? ''}`.replace(/\\/g, '/').replace(/^\/+/, '');
  if (!normalizedName) {
    return normalizedBase;
  }
  if (normalizedBase === '/') {
    return normalizeCatalogPath(`/${normalizedName}`);
  }
  return normalizeCatalogPath(`${normalizedBase}/${normalizedName}`);
}

export function toTrackMetadataCreateInput(
  path: string,
  name: string,
  metadata: InferredTrackMetadata,
) {
  return {
    path: normalizeCatalogPath(path),
    name,
    artist: metadata.artist,
    title: metadata.title,
    displayName: metadata.displayName,
    bpm: metadata.bpm,
    camelot: metadata.camelot,
    energyLevel: metadata.energyLevel,
    format: metadata.format,
    version: metadata.version,
    coverUrl: metadata.coverUrl,
    durationSeconds: metadata.durationSeconds,
    source: metadata.source,
  };
}

export function inferTrackMetadataFromFile(file: Pick<IFileStat, 'name' | 'path'>) {
  if (!file.path) return null;
  const inferred = inferTrackMetadataFromName(file.name);
  if (!inferred) return null;
  return toTrackMetadataCreateInput(file.path, file.name, inferred);
}

export async function getTrackMetadataMapByPaths(paths: string[]): Promise<Map<string, TrackMetadataView>> {
  const uniquePaths = Array.from(
    new Set(
      paths
        .map((value) => normalizeCatalogPath(value))
        .filter((value) => value && value !== '/'),
    ),
  );

  const metadataByPath = new Map<string, TrackMetadataView>();
  if (uniquePaths.length === 0) {
    return metadataByPath;
  }

  for (let idx = 0; idx < uniquePaths.length; idx += TRACK_METADATA_QUERY_BATCH) {
    const chunk = uniquePaths.slice(idx, idx + TRACK_METADATA_QUERY_BATCH);
    const rows = await prisma.trackMetadata.findMany({
      where: {
        path: {
          in: chunk,
        },
      },
      select: trackMetadataSelect,
    });

    rows.forEach((row) => {
      metadataByPath.set(normalizeCatalogPath(row.path), toTrackMetadataView(row));
    });
  }

  return metadataByPath;
}

export async function enrichFilesWithTrackMetadata<T extends IFileStat>(files: T[]): Promise<T[]> {
  if (!files.length) return files;

  const pathList = files
    .map((file) => (file.path ? normalizeCatalogPath(file.path) : null))
    .filter((value): value is string => Boolean(value));

  let metadataByPath = await getTrackMetadataMapByPaths(pathList);

  if (SPOTIFY_SYNC_ON_READ_ENABLED && isSpotifyMetadataEnabled()) {
    const syncLimit = Math.min(
      sanitizePositiveInt(SPOTIFY_SYNC_ON_READ_MAX_PER_CALL, 6),
      sanitizePositiveInt(SPOTIFY_SAFE_MAX_PER_CALL, 2),
    );
    const pathsMissingCover = pathList.filter((pathValue) => {
      const metadata = metadataByPath.get(pathValue);
      return Boolean(metadata && !metadata.coverUrl);
    });

    if (pathsMissingCover.length > 0) {
      const syncResult = await backfillSpotifyCoversForPaths(pathsMissingCover, {
        maxToProcess: Math.min(syncLimit, pathsMissingCover.length),
      });
      if (syncResult.updated > 0) {
        metadataByPath = await getTrackMetadataMapByPaths(pathList);
      }
    }
  }

  if (metadataByPath.size === 0) {
    return files;
  }

  return files.map((file) => {
    if (!file.path) return file;
    const metadata = metadataByPath.get(normalizeCatalogPath(file.path));
    if (!metadata) return file;
    return {
      ...file,
      metadata,
    };
  });
}

function sanitizePositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
}

function pruneTrackMetadataSyncRecentCache(nowMs: number): void {
  const maxEntries = sanitizePositiveInt(TRACK_METADATA_SYNC_RECENT_CACHE_MAX_ENTRIES, 12_000);
  if (trackMetadataSyncRecentlyQueuedAt.size <= maxEntries) {
    return;
  }

  const cooldownMs = sanitizePositiveInt(TRACK_METADATA_SYNC_COOLDOWN_MS, 5 * 60 * 1000);
  for (const [pathValue, queuedAt] of trackMetadataSyncRecentlyQueuedAt.entries()) {
    if (nowMs - queuedAt >= cooldownMs) {
      trackMetadataSyncRecentlyQueuedAt.delete(pathValue);
    }
    if (trackMetadataSyncRecentlyQueuedAt.size <= maxEntries) {
      return;
    }
  }

  const overflow = trackMetadataSyncRecentlyQueuedAt.size - maxEntries;
  if (overflow <= 0) return;

  let removed = 0;
  for (const pathValue of trackMetadataSyncRecentlyQueuedAt.keys()) {
    trackMetadataSyncRecentlyQueuedAt.delete(pathValue);
    removed += 1;
    if (removed >= overflow) {
      break;
    }
  }
}

export function __clearTrackMetadataSyncSchedulerForTests(): void {
  trackMetadataSyncInFlightPaths.clear();
  trackMetadataSyncRecentlyQueuedAt.clear();
}

export function scheduleTrackMetadataSyncForFiles<
  T extends Pick<IFileStat, 'name' | 'path' | 'type'>,
>(files: T[]): number {
  if (!files.length) return 0;

  const nowMs = Date.now();
  const cooldownMs = sanitizePositiveInt(TRACK_METADATA_SYNC_COOLDOWN_MS, 5 * 60 * 1000);
  const maxFilesPerCall = sanitizePositiveInt(TRACK_METADATA_SYNC_MAX_FILES_PER_CALL, 180);
  const candidatesByPath = new Map<string, T>();

  for (const file of files) {
    if (file.type !== '-' || !file.path) continue;
    const normalizedPath = normalizeCatalogPath(file.path);
    if (!normalizedPath || normalizedPath === '/') continue;
    if (trackMetadataSyncInFlightPaths.has(normalizedPath)) continue;

    const lastQueuedAt = trackMetadataSyncRecentlyQueuedAt.get(normalizedPath) ?? 0;
    if (nowMs - lastQueuedAt < cooldownMs) continue;
    if (candidatesByPath.has(normalizedPath)) continue;

    candidatesByPath.set(normalizedPath, {
      ...file,
      path: normalizedPath,
    } as T);

    if (candidatesByPath.size >= maxFilesPerCall) {
      break;
    }
  }

  const queuedFiles = Array.from(candidatesByPath.values());
  if (!queuedFiles.length) {
    return 0;
  }

  for (const file of queuedFiles) {
    const normalizedPath = normalizeCatalogPath(file.path as string);
    trackMetadataSyncInFlightPaths.add(normalizedPath);
    trackMetadataSyncRecentlyQueuedAt.set(normalizedPath, nowMs);
  }
  pruneTrackMetadataSyncRecentCache(nowMs);

  setTimeout(() => {
    void syncTrackMetadataForFiles(queuedFiles)
      .catch((error: any) => {
        log.warn(
          `[TRACK_METADATA] async sync failed: ${error?.message ?? 'unknown error'}`,
        );
      })
      .finally(() => {
        queuedFiles.forEach((file) => {
          const normalizedPath = normalizeCatalogPath(file.path as string);
          trackMetadataSyncInFlightPaths.delete(normalizedPath);
        });
      });
  }, 0);

  return queuedFiles.length;
}

export async function syncTrackMetadataForFiles<T extends Pick<IFileStat, 'name' | 'path' | 'type'>>(
  files: T[],
): Promise<number> {
  if (!files.length) return 0;

  const songsPath = `${process.env.SONGS_PATH ?? ''}`.trim();
  const embeddedConcurrencyRaw = Number(process.env.TRACK_METADATA_EMBEDDED_TAGS_CONCURRENCY ?? 6);
  const embeddedConcurrency =
    Number.isFinite(embeddedConcurrencyRaw) && embeddedConcurrencyRaw > 0
      ? Math.max(1, Math.min(12, Math.floor(embeddedConcurrencyRaw)))
      : 6;

  const candidates = files
    .filter((file) => file.type === '-' && Boolean(file.path))
    .map((file) => {
      const inferred = inferTrackMetadataFromName(file.name);
      return inferred ? { file, inferred } : null;
    })
    .filter((value): value is { file: T; inferred: InferredTrackMetadata } => Boolean(value));

  if (!candidates.length) {
    return 0;
  }

  const rows: Array<ReturnType<typeof toTrackMetadataCreateInput>> = [];

  for (let idx = 0; idx < candidates.length; idx += embeddedConcurrency) {
    const chunk = candidates.slice(idx, idx + embeddedConcurrency);
    const chunkRows = await Promise.all(
      chunk.map(async ({ file, inferred }) => {
        const catalogPath = normalizeCatalogPath(file.path as string);
        const absolutePath =
          songsPath && catalogPath !== '/'
            ? path.join(songsPath, catalogPath.replace(/^\/+/, ''))
            : null;

        let merged = inferred;
        if (absolutePath) {
          const stat = file as Partial<IFileStat>;
          const embedded = await getEmbeddedTrackTags(absolutePath, {
            mtimeMs: typeof stat.modification === 'number' ? stat.modification : undefined,
            size: typeof stat.size === 'number' ? stat.size : undefined,
          });

          const artist = embedded.artist ?? merged.artist;
          const title = embedded.title ?? merged.title;
          const displayName = artist ? `${artist} - ${title}` : title;

          merged = {
            ...merged,
            artist,
            title,
            displayName: displayName || merged.displayName,
            bpm: embedded.bpm ?? merged.bpm,
            camelot: embedded.camelot ?? merged.camelot,
            energyLevel: embedded.energyLevel ?? merged.energyLevel,
            durationSeconds: embedded.durationSeconds ?? merged.durationSeconds,
          };
        }

        return toTrackMetadataCreateInput(catalogPath, file.name, merged);
      }),
    );

    rows.push(...chunkRows);
  }

  const existingRows = await prisma.trackMetadata.findMany({
    where: {
      path: { in: rows.map((row) => normalizeCatalogPath(row.path)) },
    },
    select: {
      path: true,
    },
  });

  const existingSet = new Set(existingRows.map((row) => normalizeCatalogPath(row.path)));
  const missingRows = rows.filter((row) => !existingSet.has(normalizeCatalogPath(row.path)));
  const updateRows = rows.filter((row) => existingSet.has(normalizeCatalogPath(row.path)));

  if (!missingRows.length) {
    // We still want to update existing rows (embedded tags may have changed).
    if (updateRows.length === 0) return 0;
  }

  const created = missingRows.length
    ? await prisma.trackMetadata.createMany({
      data: missingRows,
      skipDuplicates: true,
    })
    : { count: 0 };

  if (updateRows.length) {
    // Preserve coverUrl + source (Spotify pipeline) when refreshing embedded tag metadata.
    await Promise.all(
      updateRows.map((row) =>
        prisma.trackMetadata.update({
          where: { path: normalizeCatalogPath(row.path) },
          data: {
            name: row.name,
            artist: row.artist,
            title: row.title,
            displayName: row.displayName,
            bpm: row.bpm,
            camelot: row.camelot,
            energyLevel: row.energyLevel,
            format: row.format,
            version: row.version,
            durationSeconds: row.durationSeconds,
          },
        }),
      ),
    );
  }

  const spotifyCandidatePaths = Array.from(
    new Set(rows.map((row) => normalizeCatalogPath(row.path))),
  ).filter((pathValue) => pathValue && pathValue !== '/');
  if (spotifyCandidatePaths.length > 0 && isSpotifyMetadataEnabled()) {
    const asyncSpotifyLimit = sanitizePositiveInt(SPOTIFY_SAFE_MAX_PER_CALL, 2);
    void backfillSpotifyCoversForPaths(
      spotifyCandidatePaths,
      { maxToProcess: Math.min(asyncSpotifyLimit, spotifyCandidatePaths.length) },
    )
      .catch((error: any) => {
        log.warn(`[TRACK_METADATA] async spotify backfill failed: ${error?.message ?? 'unknown error'}`);
      });
  }

  return created.count;
}

function normalizeSpotifyBackfillPaths(paths: string[]): string[] {
  return Array.from(
    new Set(
      paths
        .map((pathValue) => normalizeCatalogPath(pathValue))
        .filter((pathValue) => pathValue && pathValue !== '/'),
    ),
  );
}

function normalizeConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function buildDisplayName(artist: string | null, title: string | null): string | null {
  const safeArtist = normalizeText(artist);
  const safeTitle = normalizeText(title);
  if (safeArtist && safeTitle) {
    return `${safeArtist} - ${safeTitle}`;
  }
  return safeTitle;
}

function buildSpotifyUpdateData(
  row: SpotifyBackfillCandidate,
  spotifyMetadata: SpotifyTrackMetadataResult,
): { data: Prisma.TrackMetadataUpdateInput; shouldUpdate: boolean } {
  const data: Prisma.TrackMetadataUpdateInput = {
    source: 'spotify',
  };
  let shouldUpdate = false;

  const coverUrl = normalizeText(spotifyMetadata.coverUrl);
  if (coverUrl) {
    data.coverUrl = coverUrl;
    shouldUpdate = true;
  }

  const textConfidence = normalizeConfidence(spotifyMetadata.confidence);
  const minTextConfidence = normalizeConfidence(SPOTIFY_TEXT_METADATA_MIN_CONFIDENCE);
  if (textConfidence >= minTextConfidence) {
    const artist = normalizeText(spotifyMetadata.artist);
    const title = normalizeText(spotifyMetadata.title);

    if (artist && artist !== normalizeText(row.artist)) {
      data.artist = artist;
      shouldUpdate = true;
    }
    if (title && title !== normalizeText(row.title)) {
      data.title = title;
      shouldUpdate = true;
    }

    const displayName = buildDisplayName(artist ?? row.artist, title ?? row.title);
    if (displayName && displayName !== normalizeText(row.displayName)) {
      data.displayName = displayName;
      shouldUpdate = true;
    }
  }

  return { data, shouldUpdate };
}

async function fetchSpotifyBackfillCandidates(
  paths: string[],
  maxToProcess: number,
): Promise<SpotifyBackfillCandidate[]> {
  const nowMs = Date.now();
  const retryCutoffHours = new Date(
    nowMs - sanitizePositiveInt(SPOTIFY_MISS_RETRY_HOURS, 24) * 60 * 60 * 1000,
  );
  const retryCutoffOnRead = new Date(
    nowMs - sanitizePositiveInt(SPOTIFY_MISS_RETRY_MINUTES_ON_READ, 15) * 60 * 1000,
  );
  const spotifyMissFilter =
    paths.length > 0
      ? {
        source: 'spotify_miss' as const,
        updatedAt: {
          lt: retryCutoffOnRead,
        },
      }
      : {
        source: 'spotify_miss' as const,
        updatedAt: {
          lt: retryCutoffHours,
        },
      };

  return prisma.trackMetadata.findMany({
    where: {
      ...(paths.length
        ? {
          path: {
            in: paths,
          },
        }
        : {}),
      coverUrl: null,
      OR: [
        { source: 'inferred' },
        { source: 'spotify' },
        spotifyMissFilter,
      ],
    },
    select: {
      id: true,
      path: true,
      name: true,
      artist: true,
      title: true,
      displayName: true,
      source: true,
    },
    take: maxToProcess,
    orderBy: [{ updatedAt: 'asc' }],
  });
}

export async function backfillSpotifyCoversForPaths(
  paths: string[],
  options: { maxToProcess?: number } = {},
): Promise<{ processed: number; updated: number; misses: number }> {
  if (!isSpotifyMetadataEnabled()) {
    return { processed: 0, updated: 0, misses: 0 };
  }

  const normalizedPaths = normalizeSpotifyBackfillPaths(paths);
  if (!normalizedPaths.length) {
    return { processed: 0, updated: 0, misses: 0 };
  }

  const maxToProcess = sanitizePositiveInt(options.maxToProcess ?? SPOTIFY_DEFAULT_MAX_PER_CALL, 6);
  const candidates = await fetchSpotifyBackfillCandidates(normalizedPaths, maxToProcess);
  if (!candidates.length) {
    return { processed: 0, updated: 0, misses: 0 };
  }

  let processed = 0;
  let updated = 0;
  let misses = 0;

  for (const row of candidates) {
    processed += 1;
    let spotifyMetadata: SpotifyTrackMetadataResult | null = null;
    try {
      spotifyMetadata = await searchSpotifyTrackMetadata({
        artist: row.artist,
        title: row.title,
        displayName: row.displayName,
        fileName: row.name,
      });
    } catch (error: any) {
      if (isSpotifyRateLimitError(error)) {
        log.warn(
          `[TRACK_METADATA] Spotify rate limited while backfilling paths. Stopping early after processed=${processed}, updated=${updated}, misses=${misses}.`,
        );
        break;
      }
      log.warn(
        `[TRACK_METADATA] Spotify lookup failed for ${row.path}: ${error?.message ?? 'unknown error'}`,
      );
    }

    if (spotifyMetadata) {
      const updatePayload = buildSpotifyUpdateData(row, spotifyMetadata);
      if (updatePayload.shouldUpdate) {
        await prisma.trackMetadata.update({
          where: { id: row.id },
          data: updatePayload.data,
        });
        updated += 1;
        continue;
      }
    }

    await prisma.trackMetadata.update({
      where: { id: row.id },
      data: {
        source: 'spotify_miss',
      },
    });
    misses += 1;
  }

  return { processed, updated, misses };
}

export async function backfillSpotifyCoversForCatalog(
  options: { maxToProcess?: number } = {},
): Promise<{ processed: number; updated: number; misses: number }> {
  if (!isSpotifyMetadataEnabled()) {
    return { processed: 0, updated: 0, misses: 0 };
  }

  const maxFromEnv = Number(process.env.TRACK_METADATA_SPOTIFY_SCAN_MAX ?? 0);
  const maxRaw = options.maxToProcess ?? maxFromEnv;
  const maxToProcess =
    Number.isFinite(maxRaw) && maxRaw > 0 ? Math.floor(maxRaw) : Number.MAX_SAFE_INTEGER;
  const batchSize = Math.max(1, Math.min(25, maxToProcess));

  let processed = 0;
  let updated = 0;
  let misses = 0;

  while (processed < maxToProcess) {
    const remaining = maxToProcess - processed;
    const candidates = await fetchSpotifyBackfillCandidates(
      [],
      Math.min(batchSize, remaining),
    );
    if (!candidates.length) {
      break;
    }

    let rateLimited = false;

    for (const row of candidates) {
      processed += 1;
      let spotifyMetadata: SpotifyTrackMetadataResult | null = null;
      try {
        spotifyMetadata = await searchSpotifyTrackMetadata({
          artist: row.artist,
          title: row.title,
          displayName: row.displayName,
          fileName: row.name,
        });
      } catch (error: any) {
        if (isSpotifyRateLimitError(error)) {
          rateLimited = true;
          log.warn(
            `[TRACK_METADATA] Spotify rate limited while scanning catalog. Stopping early after processed=${processed}, updated=${updated}, misses=${misses}.`,
          );
          break;
        }
        log.warn(
          `[TRACK_METADATA] Spotify lookup failed for ${row.path}: ${error?.message ?? 'unknown error'}`,
        );
      }

      if (spotifyMetadata) {
        const updatePayload = buildSpotifyUpdateData(row, spotifyMetadata);
        if (updatePayload.shouldUpdate) {
          await prisma.trackMetadata.update({
            where: { id: row.id },
            data: updatePayload.data,
          });
          updated += 1;
          continue;
        }
      }

      await prisma.trackMetadata.update({
        where: { id: row.id },
        data: {
          source: 'spotify_miss',
        },
      });
      misses += 1;
    }

    if (rateLimited) {
      break;
    }
  }

  return { processed, updated, misses };
}

type SearchDocPointer = {
  index: number;
  mode: 'root' | 'value';
  path: string;
};

function findSearchDocPointers(documents: SearchDocument[]): SearchDocPointer[] {
  const pointers: SearchDocPointer[] = [];

  documents.forEach((doc, index) => {
    if (!doc || typeof doc !== 'object') return;

    const valueCandidate = doc.value;
    if (valueCandidate && typeof valueCandidate === 'object' && typeof valueCandidate.path === 'string') {
      pointers.push({
        index,
        mode: 'value',
        path: valueCandidate.path,
      });
      return;
    }

    if (typeof doc.path === 'string') {
      pointers.push({
        index,
        mode: 'root',
        path: doc.path,
      });
    }
  });

  return pointers;
}

export async function enrichSearchDocumentsWithTrackMetadata<T extends SearchDocument>(
  documents: T[],
): Promise<T[]> {
  if (!documents.length) return documents;

  const pointers = findSearchDocPointers(documents);
  if (!pointers.length) return documents;

  const docPaths = pointers.map((pointer) => pointer.path);
  let metadataByPath = await getTrackMetadataMapByPaths(docPaths);
  if (
    metadataByPath.size > 0
    && SPOTIFY_SYNC_ON_READ_ENABLED
    && isSpotifyMetadataEnabled()
  ) {
    const syncLimit = Math.min(
      sanitizePositiveInt(SPOTIFY_SYNC_ON_READ_MAX_PER_CALL, 6),
      sanitizePositiveInt(SPOTIFY_SAFE_MAX_PER_CALL, 2),
    );
    const pathsMissingCover = docPaths.filter((pathValue) => {
      const metadata = metadataByPath.get(normalizeCatalogPath(pathValue));
      return Boolean(metadata && !metadata.coverUrl);
    });

    if (pathsMissingCover.length > 0) {
      const syncResult = await backfillSpotifyCoversForPaths(pathsMissingCover, {
        maxToProcess: Math.min(syncLimit, pathsMissingCover.length),
      });
      if (syncResult.updated > 0) {
        metadataByPath = await getTrackMetadataMapByPaths(docPaths);
      }
    }
  }

  if (metadataByPath.size === 0) {
    return documents;
  }
  const pointerByIndex = new Map<number, SearchDocPointer>();
  pointers.forEach((pointer) => pointerByIndex.set(pointer.index, pointer));

  return documents.map((doc, index) => {
    const pointer = pointerByIndex.get(index);
    if (!pointer) return doc;

    const metadata = metadataByPath.get(normalizeCatalogPath(pointer.path));
    if (!metadata) return doc;

    if (pointer.mode === 'value') {
      return {
        ...doc,
        value: {
          ...(doc.value as Record<string, unknown>),
          metadata,
        },
      };
    }

    return {
      ...doc,
      metadata,
    };
  });
}
