import path from 'path';
import { enrichSearchDocumentsWithTrackMetadata, type TrackMetadataView } from '../metadata';
import { publicProcedure } from '../procedures/public.procedure';
import { fileIndexName, meiliSearch } from '../search';
import { router } from '../trpc';
import { log } from '../server';
import { getCatalogStats, type CatalogStatsResult } from './file-actions/catalog-stats';

export type PublicCatalogSummary = CatalogStatsResult & {
  generatedAt: string;
  /** True when the snapshot is older than the TTL and a refresh is happening in the background. */
  stale: boolean;
};

export type RecentCatalogPack = {
  folderPath: string;
  name: string;
  fileCount: number;
  addedAt: string;
  genre: string | null;
};

type RecentCatalogPackRow = {
  folderPath: string;
  name: string;
  fileCount: bigint | number;
  addedAt: Date | string;
};

type NewFileCountRow = {
  rootName: string;
  total: bigint | number;
};

export type RootNewFileCounts = {
  Audios: number;
  Karaoke: number;
  Videos: number;
};

export type PersonalizedCatalogRecommendation = {
  path: string;
  name: string;
  type: string;
  size: number;
  metadata: TrackMetadataView | null;
  genre: string | null;
  hasPreview: boolean;
};

export type PersonalizedCatalogFeed = {
  eligible: boolean;
  totalDownloads: number;
  recommendations: PersonalizedCatalogRecommendation[];
};

type UserDownloadCountRow = {
  total: bigint | number;
};

type UserDownloadedPathRow = {
  fileName: string;
};

type MetadataSeedRow = {
  path: string;
  name: string;
  artist: string | null;
};

const RECENT_PACKS_GENRE_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: 'Reggaeton', pattern: /\breggaeton\b/i },
  { label: 'Dembow', pattern: /\bdembow\b/i },
  { label: 'Bachata', pattern: /\bbachata\b/i },
  { label: 'Salsa', pattern: /\bsalsa\b/i },
  { label: 'Merengue', pattern: /\bmerengue\b/i },
  { label: 'Cumbia', pattern: /\bcumbia\b/i },
  { label: 'Trap', pattern: /\btrap\b/i },
  { label: 'House', pattern: /\bhouse\b/i },
  { label: 'Techno', pattern: /\btechno\b/i },
  { label: 'Electro', pattern: /\belectro\b/i },
];
const AUDIO_FILE_REGEX = /\.(mp3|aac|m4a|flac|ogg|aiff|alac)$/i;
const VIDEO_FILE_REGEX = /\.(mp4|mov|mkv|avi|wmv|webm|m4v)$/i;
const MEDIA_FILE_REGEX = /\.(mp3|aac|m4a|flac|ogg|aiff|alac|mp4|mov|mkv|avi|wmv|webm|m4v)$/i;
const PREVIEWABLE_FORMATS = new Set([
  'MP3',
  'AAC',
  'M4A',
  'FLAC',
  'OGG',
  'AIFF',
  'ALAC',
  'MP4',
  'MOV',
  'MKV',
  'AVI',
  'WMV',
  'WEBM',
  'M4V',
]);
const PERSONALIZED_MIN_DOWNLOADS = 10;
const PERSONALIZED_LOOKBACK_DOWNLOADS = 20;
const PERSONALIZED_SEARCH_LIMIT_PER_TERM = 80;
const PERSONALIZED_MAX_TERMS_PER_GROUP = 4;
const PERSONALIZED_RESULT_LIMIT = 10;

const normalizeFolderPath = (value: unknown): string =>
  `${value ?? ''}`
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\/+|\/+$/g, '');

const normalizeOptionalText = (value: unknown): string | null => {
  const text = `${value ?? ''}`.trim();
  return text ? text : null;
};

const normalizeOptionalNumber = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return value;
};

const normalizeLookupKey = (value: string): string => value.toLocaleLowerCase('es-MX');

const toSafeInteger = (value: bigint | number): number => {
  if (typeof value === 'bigint') {
    const max = BigInt(Number.MAX_SAFE_INTEGER);
    return Number(value > max ? max : value);
  }
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
};

const toIsoDate = (value: Date | string): string => {
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString();
  }
  return parsed.toISOString();
};

const inferGenre = (folderPath: string, name: string): string | null => {
  const haystack = `${folderPath} ${name}`.toLowerCase();
  const matched = RECENT_PACKS_GENRE_PATTERNS.find((entry) => entry.pattern.test(haystack));
  return matched?.label ?? null;
};

const inferMediaCategory = (catalogPath: string, fileName: string): string | null => {
  const normalizedPath = normalizeFolderPath(catalogPath).toLowerCase();
  const normalizedName = `${fileName ?? ''}`.toLowerCase();
  const signature = `${normalizedPath} ${normalizedName}`;

  if (
    signature.includes('/karaoke/') ||
    signature.includes('/karaokes/') ||
    signature.startsWith('karaoke/') ||
    signature.startsWith('karaokes/') ||
    signature.includes(' karaoke ')
  ) {
    return 'Karaoke';
  }

  if (VIDEO_FILE_REGEX.test(normalizedPath) || VIDEO_FILE_REGEX.test(normalizedName)) {
    return 'Video';
  }
  if (AUDIO_FILE_REGEX.test(normalizedPath) || AUDIO_FILE_REGEX.test(normalizedName)) {
    return 'Audio';
  }
  return null;
};

const resolveFormatBadge = (fileName: string, metadataFormat: unknown): string | null => {
  const fromMetadata = normalizeOptionalText(metadataFormat);
  if (fromMetadata) return fromMetadata.toUpperCase();

  const ext = fileName.includes('.')
    ? fileName.slice(fileName.lastIndexOf('.') + 1).trim()
    : '';
  if (!ext || ext.length > 5) return null;
  return ext.toUpperCase();
};

const normalizeTrackMetadata = (value: unknown): TrackMetadataView | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;

  return {
    artist: normalizeOptionalText(raw.artist),
    title: normalizeOptionalText(raw.title),
    displayName: normalizeOptionalText(raw.displayName),
    bpm: normalizeOptionalNumber(raw.bpm),
    camelot: normalizeOptionalText(raw.camelot),
    energyLevel: normalizeOptionalNumber(raw.energyLevel),
    format: normalizeOptionalText(raw.format),
    version: normalizeOptionalText(raw.version),
    coverUrl: normalizeOptionalText(raw.coverUrl),
    durationSeconds: normalizeOptionalNumber(raw.durationSeconds),
    source: normalizeOptionalText(raw.source) === 'database' ? 'database' : 'inferred',
  };
};

type CounterEntry = {
  label: string;
  count: number;
};

const bumpCounter = (counter: Map<string, CounterEntry>, rawLabel: string | null) => {
  if (!rawLabel) return;
  const label = rawLabel.trim();
  if (!label) return;
  const key = normalizeLookupKey(label);
  const existing = counter.get(key);
  counter.set(key, {
    label: existing?.label ?? label,
    count: (existing?.count ?? 0) + 1,
  });
};

const getTopCounterLabels = (
  counter: Map<string, CounterEntry>,
  limit: number,
): string[] =>
  Array.from(counter.values())
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count;
      return left.label.localeCompare(right.label, 'es-MX');
    })
    .slice(0, limit)
    .map((entry) => entry.label);

const getSessionLoginDate = (sessionUser: unknown): Date | null => {
  if (!sessionUser || typeof sessionUser !== 'object') return null;
  const iat = (sessionUser as { iat?: unknown }).iat;
  if (typeof iat !== 'number' || !Number.isFinite(iat) || iat <= 0) return null;
  const date = new Date(iat * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
};

const createEmptyRootCounts = (): RootNewFileCounts => ({
  Audios: 0,
  Karaoke: 0,
  Videos: 0,
});

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

export async function getPublicCatalogSummarySnapshot(): Promise<PublicCatalogSummary> {
  const now = Date.now();
  if (cached && now - cachedAt < CATALOG_SUMMARY_TTL_MS) {
    return { ...cached, stale: false };
  }

  // Stale-while-revalidate: return stale immediately, refresh in the background.
  if (cached) {
    void refreshCatalogSummary();
    return { ...cached, stale: true };
  }

  // First request: compute once, then cache.
  return refreshCatalogSummary();
}

export const catalogRouter = router({
  /**
   * Public catalog snapshot for the landing page.
   * Uses a long TTL + singleflight refresh to avoid heavy scans per visitor.
   */
  getPublicCatalogSummary: publicProcedure.query(async () => {
    return getPublicCatalogSummarySnapshot();
  }),

  /**
   * Recent catalog packs for authenticated homepage discovery.
   * Groups by folder (dirname of track path), ordered by latest metadata insertion.
   */
  getRecentPacks: publicProcedure.query(async ({ ctx }): Promise<RecentCatalogPack[]> => {
    try {
      const rows = await ctx.prisma.$queryRaw<RecentCatalogPackRow[]>`
        SELECT
          grouped.folder_path AS folderPath,
          SUBSTRING_INDEX(grouped.folder_path, '/', -1) AS name,
          grouped.file_count AS fileCount,
          grouped.added_at AS addedAt
        FROM (
          SELECT
            TRIM(BOTH '/' FROM
              CASE
                WHEN INSTR(REPLACE(path, CHAR(92), '/'), '/') = 0 THEN ''
                ELSE LEFT(
                  REPLACE(path, CHAR(92), '/'),
                  CHAR_LENGTH(REPLACE(path, CHAR(92), '/')) -
                  CHAR_LENGTH(SUBSTRING_INDEX(REPLACE(path, CHAR(92), '/'), '/', -1)) -
                  1
                )
              END
            ) AS folder_path,
            COUNT(*) AS file_count,
            MAX(created_at) AS added_at
          FROM track_metadata
          WHERE path IS NOT NULL
            AND path <> ''
          GROUP BY folder_path
        ) AS grouped
        WHERE grouped.folder_path <> ''
          AND grouped.file_count > 0
        ORDER BY grouped.added_at DESC
        LIMIT 20
      `;

      return rows
        .map((row) => {
          const folderPath = normalizeFolderPath(row.folderPath);
          const fileCount = toSafeInteger(row.fileCount);
          const normalizedName = `${row.name ?? ''}`.trim();
          const name = normalizedName || folderPath.split('/').pop() || 'Pack';

          if (!folderPath || fileCount <= 0) return null;

          return {
            folderPath,
            name,
            fileCount,
            addedAt: toIsoDate(row.addedAt),
            genre: inferGenre(folderPath, name),
          };
        })
        .filter((row): row is RecentCatalogPack => Boolean(row));
    } catch (error: any) {
      log.warn(`[CATALOG_RECENT_PACKS] Query failed: ${error?.message ?? 'unknown error'}`);
      return [];
    }
  }),

  /**
   * New files since the current session started (JWT iat),
   * grouped by root folders shown on Home.
   */
  getNewFileCounts: publicProcedure.query(async ({ ctx }): Promise<RootNewFileCounts> => {
    const counts = createEmptyRootCounts();
    const loginDate = getSessionLoginDate(ctx.session?.user);
    if (!loginDate) {
      return counts;
    }

    try {
      const rows = await ctx.prisma.$queryRaw<NewFileCountRow[]>`
        SELECT
          grouped.root_name AS rootName,
          COUNT(*) AS total
        FROM (
          SELECT
            LOWER(SUBSTRING_INDEX(TRIM(BOTH '/' FROM REPLACE(path, CHAR(92), '/')), '/', 1)) AS root_name
          FROM track_metadata
          WHERE path IS NOT NULL
            AND path <> ''
            AND created_at > ${loginDate}
        ) AS grouped
        WHERE grouped.root_name IN ('audio', 'audios', 'karaoke', 'karaokes', 'video', 'videos')
        GROUP BY grouped.root_name
      `;

      rows.forEach((row) => {
        const value = toSafeInteger(row.total);
        if (row.rootName === 'audio' || row.rootName === 'audios') counts.Audios += value;
        if (row.rootName === 'karaoke' || row.rootName === 'karaokes') counts.Karaoke += value;
        if (row.rootName === 'video' || row.rootName === 'videos') counts.Videos += value;
      });

      return counts;
    } catch (error: any) {
      log.warn(`[CATALOG_NEW_FILE_COUNTS] Query failed: ${error?.message ?? 'unknown error'}`);
      return counts;
    }
  }),

  /**
   * Personalized discovery feed:
   * - last 20 downloads (user taste sample)
   * - top artists/genres from that sample
   * - search similar files in Meilisearch excluding already downloaded files
   */
  getForYouRecommendations: publicProcedure.query(async ({ ctx }): Promise<PersonalizedCatalogFeed> => {
    const userId = ctx.session?.user?.id;
    if (!userId || !Number.isFinite(userId)) {
      return {
        eligible: false,
        totalDownloads: 0,
        recommendations: [],
      };
    }

    try {
      const [countRows, recentRows] = await Promise.all([
        ctx.prisma.$queryRaw<UserDownloadCountRow[]>`
          SELECT COUNT(*) AS total
          FROM download_history dh
          WHERE dh.userId = ${userId}
            AND dh.isFolder = 0
            AND dh.fileName IS NOT NULL
            AND dh.fileName <> ''
        `,
        ctx.prisma.$queryRaw<UserDownloadedPathRow[]>`
          SELECT dh.fileName AS fileName
          FROM download_history dh
          WHERE dh.userId = ${userId}
            AND dh.isFolder = 0
            AND dh.fileName IS NOT NULL
            AND dh.fileName <> ''
          ORDER BY dh.date DESC
          LIMIT ${PERSONALIZED_LOOKBACK_DOWNLOADS}
        `,
      ]);

      const totalDownloads = toSafeInteger((countRows[0]?.total ?? 0) as bigint | number);
      if (totalDownloads < PERSONALIZED_MIN_DOWNLOADS) {
        return {
          eligible: false,
          totalDownloads,
          recommendations: [],
        };
      }

      const downloadedRows = await ctx.prisma.$queryRaw<UserDownloadedPathRow[]>`
        SELECT DISTINCT dh.fileName AS fileName
        FROM download_history dh
        WHERE dh.userId = ${userId}
          AND dh.isFolder = 0
          AND dh.fileName IS NOT NULL
          AND dh.fileName <> ''
      `;

      const downloadedPathSet = new Set(
        downloadedRows
          .map((row) => normalizeFolderPath(row.fileName))
          .filter(Boolean),
      );

      const recentPaths = recentRows
        .map((row) => normalizeFolderPath(row.fileName))
        .filter(Boolean);

      if (!recentPaths.length) {
        return {
          eligible: true,
          totalDownloads,
          recommendations: [],
        };
      }

      const uniqueRecentPaths = Array.from(new Set(recentPaths));
      const metadataRows = await ctx.prisma.trackMetadata.findMany({
        where: {
          path: {
            in: uniqueRecentPaths,
          },
        },
        select: {
          path: true,
          name: true,
          artist: true,
        },
      });
      const metadataByPath = new Map<string, MetadataSeedRow>();
      metadataRows.forEach((row) => {
        metadataByPath.set(normalizeFolderPath(row.path), row);
      });

      const artistCounter = new Map<string, CounterEntry>();
      const genreCounter = new Map<string, CounterEntry>();

      recentPaths.forEach((catalogPath) => {
        const metadata = metadataByPath.get(catalogPath);
        const nameFromPath = path.basename(catalogPath) || catalogPath;
        const referenceName = metadata?.name || nameFromPath;
        const genreLabel =
          inferGenre(catalogPath, referenceName) ||
          inferMediaCategory(catalogPath, referenceName);
        bumpCounter(artistCounter, normalizeOptionalText(metadata?.artist));
        bumpCounter(genreCounter, genreLabel);
      });

      const topArtists = getTopCounterLabels(artistCounter, PERSONALIZED_MAX_TERMS_PER_GROUP);
      const topGenres = getTopCounterLabels(genreCounter, PERSONALIZED_MAX_TERMS_PER_GROUP);
      const searchTerms = Array.from(new Set([...topArtists, ...topGenres])).filter(Boolean);

      if (!searchTerms.length) {
        return {
          eligible: true,
          totalDownloads,
          recommendations: [],
        };
      }

      const searchResults = await Promise.allSettled(
        searchTerms.map(async (term) =>
          meiliSearch.index(fileIndexName).search(term, {
            limit: PERSONALIZED_SEARCH_LIMIT_PER_TERM,
          })),
      );

      const rawHits = searchResults.flatMap((result) => {
        if (result.status !== 'fulfilled') return [];
        return Array.isArray(result.value.hits)
          ? (result.value.hits as Array<Record<string, unknown>>)
          : [];
      });

      if (!rawHits.length) {
        return {
          eligible: true,
          totalDownloads,
          recommendations: [],
        };
      }

      const searchDocs = rawHits
        .map((hit) => {
          if (hit?.value && typeof hit.value === 'object') {
            return hit.value as Record<string, unknown>;
          }
          return hit;
        })
        .filter((doc) => doc && typeof doc === 'object') as Array<Record<string, unknown>>;

      let enrichedDocs = searchDocs;
      try {
        enrichedDocs = await enrichSearchDocumentsWithTrackMetadata(searchDocs);
      } catch (error: any) {
        log.warn(
          `[CATALOG_FOR_YOU] metadata enrichment failed: ${error?.message ?? 'unknown error'}`,
        );
      }

      const artistKeySet = new Set(topArtists.map((entry) => normalizeLookupKey(entry)));
      const genreKeySet = new Set(topGenres.map((entry) => normalizeLookupKey(entry)));
      const searchTermKeyList = searchTerms.map((term) => normalizeLookupKey(term));
      const candidateByPath = new Map<string, PersonalizedCatalogRecommendation & { score: number }>();

      enrichedDocs.forEach((doc) => {
        const catalogPath = normalizeFolderPath(doc.path);
        if (!catalogPath) return;
        if (downloadedPathSet.has(catalogPath)) return;
        if (`${doc.type ?? ''}`.toLowerCase() === 'd') return;

        const fileName = normalizeOptionalText(doc.name) || path.basename(catalogPath) || catalogPath;
        if (!MEDIA_FILE_REGEX.test(catalogPath) && !MEDIA_FILE_REGEX.test(fileName)) return;

        const metadata = normalizeTrackMetadata(doc.metadata);
        const artist = metadata?.artist ?? null;
        const genre =
          inferGenre(catalogPath, fileName) ||
          inferMediaCategory(catalogPath, fileName);
        const artistKey = artist ? normalizeLookupKey(artist) : null;
        const genreKey = genre ? normalizeLookupKey(genre) : null;
        const searchableHaystack = `${fileName} ${catalogPath} ${artist ?? ''}`.toLocaleLowerCase('es-MX');

        let score = 0;
        if (artistKey && artistKeySet.has(artistKey)) score += 4;
        if (genreKey && genreKeySet.has(genreKey)) score += 3;
        if (score === 0 && searchTermKeyList.some((term) => searchableHaystack.includes(term))) {
          score = 1;
        }
        if (score === 0) return;

        const formatBadge = resolveFormatBadge(fileName, metadata?.format);
        const recommendation: PersonalizedCatalogRecommendation & { score: number } = {
          path: catalogPath,
          name: fileName,
          type: `${doc.type ?? '-'}`,
          size: typeof doc.size === 'number' && Number.isFinite(doc.size) ? doc.size : 0,
          metadata,
          genre,
          hasPreview: Boolean(formatBadge && PREVIEWABLE_FORMATS.has(formatBadge)),
          score,
        };

        const existing = candidateByPath.get(catalogPath);
        if (!existing || recommendation.score > existing.score) {
          candidateByPath.set(catalogPath, recommendation);
        }
      });

      const recommendations = Array.from(candidateByPath.values())
        .sort((left, right) => {
          if (right.score !== left.score) return right.score - left.score;
          if (left.hasPreview !== right.hasPreview) return left.hasPreview ? -1 : 1;
          return left.name.localeCompare(right.name, 'es-MX');
        })
        .slice(0, PERSONALIZED_RESULT_LIMIT)
        .map(({ score: _score, ...recommendation }) => recommendation);

      return {
        eligible: true,
        totalDownloads,
        recommendations,
      };
    } catch (error: any) {
      log.warn(`[CATALOG_FOR_YOU] Query failed: ${error?.message ?? 'unknown error'}`);
      return {
        eligible: false,
        totalDownloads: 0,
        recommendations: [],
      };
    }
  }),
});
