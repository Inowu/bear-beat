import { TrackMetadata } from '@prisma/client';
import { prisma } from '../db';
import { IFileStat } from '../services/interfaces/fileService.interface';
import { log } from '../server';
import { isSpotifyMetadataEnabled, searchSpotifyTrackCover } from '../spotify';
import {
  InferredTrackMetadata,
  inferTrackMetadataFromName,
  normalizeCatalogPath,
} from './inferTrackMetadata';

const TRACK_METADATA_QUERY_BATCH = 400;
const SPOTIFY_MISS_RETRY_HOURS = Number(process.env.TRACK_METADATA_SPOTIFY_MISS_RETRY_HOURS ?? 24);
const SPOTIFY_DEFAULT_MAX_PER_CALL = Number(process.env.TRACK_METADATA_SPOTIFY_MAX_PER_CALL ?? 6);

const trackMetadataSelect = {
  path: true,
  artist: true,
  title: true,
  displayName: true,
  bpm: true,
  camelot: true,
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

  const metadataByPath = await getTrackMetadataMapByPaths(pathList);
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

export async function syncTrackMetadataForFiles<T extends Pick<IFileStat, 'name' | 'path' | 'type'>>(
  files: T[],
): Promise<number> {
  if (!files.length) return 0;

  const candidateRows = files
    .filter((file) => file.type === '-' && Boolean(file.path))
    .map((file) => inferTrackMetadataFromFile(file))
    .filter((value): value is NonNullable<ReturnType<typeof inferTrackMetadataFromFile>> => Boolean(value));

  if (!candidateRows.length) {
    return 0;
  }

  const existingMap = await getTrackMetadataMapByPaths(candidateRows.map((row) => row.path));
  const missingRows = candidateRows.filter((row) => !existingMap.has(normalizeCatalogPath(row.path)));

  if (!missingRows.length) {
    return 0;
  }

  const created = await prisma.trackMetadata.createMany({
    data: missingRows,
    skipDuplicates: true,
  });

  const freshPaths = missingRows.map((row) => row.path);
  if (freshPaths.length > 0 && isSpotifyMetadataEnabled()) {
    void backfillSpotifyCoversForPaths(freshPaths, { maxToProcess: Math.min(4, freshPaths.length) })
      .catch((error: any) => {
        log.warn(`[TRACK_METADATA] async spotify backfill failed: ${error?.message ?? 'unknown error'}`);
      });
  }

  return created.count;
}

function sanitizePositiveInt(value: number, fallback: number): number {
  if (!Number.isFinite(value) || value <= 0) return fallback;
  return Math.floor(value);
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

async function fetchSpotifyBackfillCandidates(
  paths: string[],
  maxToProcess: number,
): Promise<SpotifyBackfillCandidate[]> {
  const retryCutoff = new Date(
    Date.now() - sanitizePositiveInt(SPOTIFY_MISS_RETRY_HOURS, 24) * 60 * 60 * 1000,
  );

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
        {
          source: 'spotify_miss',
          updatedAt: {
            lt: retryCutoff,
          },
        },
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
    const coverUrl = await searchSpotifyTrackCover({
      artist: row.artist,
      title: row.title,
      displayName: row.displayName,
      fileName: row.name,
    });

    if (coverUrl) {
      await prisma.trackMetadata.update({
        where: { id: row.id },
        data: {
          coverUrl,
          source: 'spotify',
        },
      });
      updated += 1;
      continue;
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

    for (const row of candidates) {
      processed += 1;
      const coverUrl = await searchSpotifyTrackCover({
        artist: row.artist,
        title: row.title,
        displayName: row.displayName,
        fileName: row.name,
      });

      if (coverUrl) {
        await prisma.trackMetadata.update({
          where: { id: row.id },
          data: {
            coverUrl,
            source: 'spotify',
          },
        });
        updated += 1;
        continue;
      }

      await prisma.trackMetadata.update({
        where: { id: row.id },
        data: {
          source: 'spotify_miss',
        },
      });
      misses += 1;
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

  const metadataByPath = await getTrackMetadataMapByPaths(pointers.map((pointer) => pointer.path));
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
