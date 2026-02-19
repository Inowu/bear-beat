import path from 'path';
import { createHash } from 'crypto';
import Ffmpeg from 'fluent-ffmpeg';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { Prisma, PrismaClient } from '@prisma/client';
import { shieldedProcedure } from '../procedures/shielded.procedure';
import { publicProcedure } from '../procedures/public.procedure';
import { fileService } from '../ftp';
import { log } from '../server';
import type { IFileStat } from '../services/interfaces/fileService.interface';
import { router } from '../trpc';
import { extendedAccountPostfix } from '../utils/constants';
import { buildDemoPublicUrl } from '../utils/demoMedia';
import { toUtcDay } from '../utils/downloadHistoryRollup';

interface DownloadHistory {
  id: number;
  userId: number;
  size: bigint;
  date: Date;
  fileName: string;
  isFolder: boolean;
  email: string;
  phone: string;
}

type TopDownloadKind = 'audio' | 'video';
type TopDownloadCategory = TopDownloadKind | 'karaoke';

interface TopDownloadRow {
  fileName: string;
  downloads: bigint | number;
  lastDownload: Date;
  totalBytes: bigint | number;
}

interface RollupCoverageRow {
  category: string;
  minDay: Date | string | null;
}

interface TopDownloadItem {
  path: string;
  name: string;
  type: TopDownloadCategory;
  downloads: number;
  totalGb: number;
  lastDownload: string;
}

interface WeeklyGenreUpload {
  genre: string;
  files: number;
}

interface WeeklyFolderCandidate {
  fullPath: string;
  relativePath: string;
  name: string;
  modification: number;
  score: number;
}

interface PublicWeeklyGenreUploadsSnapshot {
  generatedAt: string;
  sourceFolderPath: string | null;
  sourceFolderName: string | null;
  totalFiles: number;
  genres: WeeklyGenreUpload[];
  topGenres: WeeklyGenreUpload[];
  stale: boolean;
}

interface PublicExplorerPreviewFile {
  path: string;
  name: string;
}

interface PublicExplorerPreviewSnapshot {
  generatedAt: string;
  sourceFolderPath: string | null;
  sourceFolderName: string | null;
  explorerPath: string[];
  files: PublicExplorerPreviewFile[];
  stale: boolean;
}

interface ExplorerPreviewFileCandidate extends PublicExplorerPreviewFile {
  modification: number;
  hasTempoKey: boolean;
}

interface ExplorerPreviewFolderCandidate {
  fullPath: string;
  relativePath: string;
  name: string;
  fileCount: number;
  modification: number;
}

const AUDIO_EXTENSIONS = [
  '.mp3',
  '.aac',
  '.m4a',
  '.flac',
  '.ogg',
  '.aiff',
  '.alac',
];
const VIDEO_EXTENSIONS = [
  '.mp4',
  '.mov',
  '.mkv',
  '.avi',
  '.wmv',
  '.webm',
  '.m4v',
];
const DEFAULT_PUBLIC_TOP_LIMIT = 100;
const MAX_PUBLIC_TOP_LIMIT = 100;
const DEFAULT_PUBLIC_TOP_DAYS = 120;
const MAX_PUBLIC_TOP_DAYS = 3650;
const DEFAULT_WEEKLY_TOP_GENRES = 5;
const MAX_WEEKLY_TOP_GENRES = 12;
const PUBLIC_WEEKLY_UPLOADS_CACHE_TTL_MS = 2 * 60 * 1000;
const DEFAULT_PUBLIC_EXPLORER_PREVIEW_LIMIT = 6;
const MAX_PUBLIC_EXPLORER_PREVIEW_LIMIT = 10;
const PUBLIC_EXPLORER_PREVIEW_CACHE_TTL_MS = 2 * 60 * 1000;
const MAX_WEEKLY_SCAN_DEPTH = 6;
const WEEK_FOLDER_HINT_REGEX = /(?:\bsemana\b|\bweek\b|\bweekly\b|\bwk[\s_-]*\d{1,2}\b|\bsem[\s_-]*\d{1,2}\b)/i;
const GENERIC_WEEK_BUCKET_REGEX = /^(?:audio|audios|video|videos|karaoke|karaokes|music|musica)$/i;
const FILE_HAS_TEMPO_KEY_REGEX = /\b(?:1[0-2]|[1-9])\s*[AB]\b/i;
const FILE_HAS_BPM_REGEX = /\b\d{2,3}\s*bpm\b/i;
const WEEKLY_GENRE_ALIASES: Array<{ label: string; pattern: RegExp }> = [
  { label: 'reggaetón', pattern: /\b(?:reggaeton|reggaet[oó]n|reguetton|requetton)\b/i },
  { label: 'cumbia', pattern: /\bcumbia\b/i },
  { label: 'dembow', pattern: /\bdembow\b/i },
  { label: 'bachata', pattern: /\bbachata\b/i },
  { label: 'house', pattern: /\bhouse\b/i },
  { label: 'guaracha', pattern: /\bguaracha\b/i },
  { label: 'corridos', pattern: /\bcorridos?\b/i },
  { label: 'banda', pattern: /\bbanda\b/i },
  { label: 'huapango', pattern: /\bhuapango\b/i },
  { label: 'punta', pattern: /\bpunta\b/i },
];

const normalizeCatalogPath = (value: string): string =>
  value.replace(/\\/g, '/').replace(/^\/+/, '').trim();

const getKindFromPath = (filePath: string): TopDownloadKind | null => {
  const normalizedPath = normalizeCatalogPath(filePath).toLowerCase();
  if (AUDIO_EXTENSIONS.some((extension) => normalizedPath.endsWith(extension))) {
    return 'audio';
  }
  if (VIDEO_EXTENSIONS.some((extension) => normalizedPath.endsWith(extension))) {
    return 'video';
  }
  return null;
};

const getExtensionsForKind = (kind: TopDownloadKind): string[] =>
  kind === 'audio' ? AUDIO_EXTENSIONS : VIDEO_EXTENSIONS;

const getAllMediaExtensions = (): string[] => [
  ...AUDIO_EXTENSIONS,
  ...VIDEO_EXTENSIONS,
];

const MEDIA_EXTENSION_SET = new Set(
  getAllMediaExtensions().map((extension) => extension.toLowerCase()),
);

const normalizeCatalogRelativePath = (value: string): string =>
  normalizeCatalogPath(value).replace(/^\/+|\/+$/g, '');

const joinCatalogRelativePath = (base: string, nextSegment: string): string => {
  const left = normalizeCatalogRelativePath(base);
  const right = normalizeCatalogRelativePath(nextSegment);
  if (!left) return right;
  if (!right) return left;
  return `${left}/${right}`;
};

const isMediaFileName = (fileName: string): boolean =>
  MEDIA_EXTENSION_SET.has(path.extname(`${fileName ?? ''}`).toLowerCase());

const cleanWeeklyGenreLabel = (raw: string): string => {
  const compact = `${raw ?? ''}`
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  if (!compact) return 'otros';

  const matched = WEEKLY_GENRE_ALIASES.find((entry) => entry.pattern.test(compact));
  if (matched) return matched.label;
  return compact;
};

const listDirectorySafe = async (directoryPath: string): Promise<IFileStat[]> => {
  try {
    const listed = await fileService.list(directoryPath);
    return listed.filter((entry) => entry && typeof entry.name === 'string');
  } catch {
    return [];
  }
};

const countMediaFilesRecursive = async (
  directoryPath: string,
  depth = 0,
): Promise<number> => {
  if (depth > MAX_WEEKLY_SCAN_DEPTH) return 0;

  const entries = await listDirectorySafe(directoryPath);
  let total = 0;

  for (const entry of entries) {
    if (entry.type === '-') {
      if (isMediaFileName(entry.name)) total += 1;
      continue;
    }
    if (entry.type === 'd') {
      total += await countMediaFilesRecursive(
        path.join(directoryPath, entry.name),
        depth + 1,
      );
    }
  }

  return total;
};

const bumpWeeklyGenreCounter = (
  counter: Map<string, number>,
  rawGenre: string,
  amount: number,
) => {
  if (!Number.isFinite(amount) || amount <= 0) return;
  const genre = cleanWeeklyGenreLabel(rawGenre);
  counter.set(genre, (counter.get(genre) ?? 0) + Math.floor(amount));
};

const toSortedWeeklyGenres = (counter: Map<string, number>): WeeklyGenreUpload[] =>
  Array.from(counter.entries())
    .map(([genre, files]) => ({
      genre,
      files: Number.isFinite(files) ? Math.max(0, Math.floor(files)) : 0,
    }))
    .filter((row) => row.files > 0)
    .sort((left, right) => {
      if (right.files !== left.files) return right.files - left.files;
      return left.genre.localeCompare(right.genre, 'es-MX');
    });

const createEmptyWeeklyUploadsSnapshot = (): PublicWeeklyGenreUploadsSnapshot => ({
  generatedAt: new Date().toISOString(),
  sourceFolderPath: null,
  sourceFolderName: null,
  totalFiles: 0,
  genres: [],
  topGenres: [],
  stale: false,
});

const normalizeExplorerSegmentKey = (value: string): string =>
  `${value ?? ''}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const toExplorerPathSegments = (relativePath: string): string[] => {
  const segments = normalizeCatalogRelativePath(relativePath)
    .split('/')
    .map((segment) => segment.trim())
    .filter(Boolean);

  const deduped: string[] = [];
  let previousKey = '';
  for (const segment of segments) {
    const segmentKey = normalizeExplorerSegmentKey(segment);
    if (!segmentKey) continue;
    if (segmentKey === previousKey) continue;
    deduped.push(segment);
    previousKey = segmentKey;
  }
  return deduped;
};

const hasTempoAndKeyInFileName = (fileName: string): boolean => {
  const normalized = `${fileName ?? ''}`.trim();
  if (!normalized) return false;
  return FILE_HAS_BPM_REGEX.test(normalized) && FILE_HAS_TEMPO_KEY_REGEX.test(normalized);
};

const sortDirectoryEntriesForExplorer = (entries: IFileStat[]): IFileStat[] =>
  [...entries].sort((left, right) => {
    if (left.type === '-' && right.type !== '-') return -1;
    if (left.type !== '-' && right.type === '-') return 1;

    const leftModification = Number(left.modification ?? 0);
    const rightModification = Number(right.modification ?? 0);
    if (rightModification !== leftModification) {
      return rightModification - leftModification;
    }

    return `${left.name ?? ''}`.localeCompare(`${right.name ?? ''}`, 'es-MX');
  });

const toExplorerFolderName = (relativePath: string): string | null => {
  const normalized = normalizeCatalogRelativePath(relativePath);
  if (!normalized) return null;
  const last = normalized.split('/').filter(Boolean).pop();
  return last ? last.trim() : null;
};

const createEmptyExplorerPreviewSnapshot = (): PublicExplorerPreviewSnapshot => ({
  generatedAt: new Date().toISOString(),
  sourceFolderPath: null,
  sourceFolderName: null,
  explorerPath: [],
  files: [],
  stale: false,
});

const getLatestWeeklyFolderCandidate = async (
  songsBasePath: string,
): Promise<WeeklyFolderCandidate | null> => {
  const rootEntries = (await listDirectorySafe(songsBasePath)).filter(
    (entry) => entry.type === 'd',
  );

  const candidates: WeeklyFolderCandidate[] = [];

  for (const level1 of rootEntries) {
    const level1Path = path.join(songsBasePath, level1.name);
    const level1Rel = normalizeCatalogRelativePath(level1.name);
    const level2Entries = (await listDirectorySafe(level1Path)).filter(
      (entry) => entry.type === 'd',
    );

    for (const level2 of level2Entries) {
      const level2Path = path.join(level1Path, level2.name);
      const level2Rel = joinCatalogRelativePath(level1Rel, level2.name);
      const level3Entries = (await listDirectorySafe(level2Path)).filter(
        (entry) => entry.type === 'd',
      );

      if (level3Entries.length === 0) {
        const score = WEEK_FOLDER_HINT_REGEX.test(level2.name) ? 2 : 0;
        candidates.push({
          fullPath: level2Path,
          relativePath: level2Rel,
          name: level2.name,
          modification: Number(level2.modification ?? 0),
          score,
        });
        continue;
      }

      for (const level3 of level3Entries) {
        const level3Rel = joinCatalogRelativePath(level2Rel, level3.name);
        const score = WEEK_FOLDER_HINT_REGEX.test(level3.name) ? 3 : 1;
        candidates.push({
          fullPath: path.join(level2Path, level3.name),
          relativePath: level3Rel,
          name: level3.name,
          modification: Number(level3.modification ?? 0),
          score,
        });
      }
    }
  }

  if (candidates.length === 0) return null;

  candidates.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    if (right.modification !== left.modification) {
      return right.modification - left.modification;
    }
    return right.relativePath.localeCompare(left.relativePath, 'es-MX');
  });

  return candidates[0] ?? null;
};

const buildWeeklyGenreUploadsSnapshot = async (): Promise<PublicWeeklyGenreUploadsSnapshot> => {
  const songsBasePath = `${process.env.SONGS_PATH ?? ''}`.trim();
  if (!songsBasePath) return createEmptyWeeklyUploadsSnapshot();

  const latestWeeklyFolder = await getLatestWeeklyFolderCandidate(songsBasePath);
  if (!latestWeeklyFolder) return createEmptyWeeklyUploadsSnapshot();

  const weeklyEntries = await listDirectorySafe(latestWeeklyFolder.fullPath);
  const counter = new Map<string, number>();

  for (const entry of weeklyEntries) {
    const entryPath = path.join(latestWeeklyFolder.fullPath, entry.name);

    if (entry.type === '-' && isMediaFileName(entry.name)) {
      bumpWeeklyGenreCounter(counter, entry.name, 1);
      continue;
    }

    if (entry.type !== 'd') continue;

    if (GENERIC_WEEK_BUCKET_REGEX.test(entry.name)) {
      const nested = await listDirectorySafe(entryPath);
      let usedNestedDirectories = false;

      for (const nestedEntry of nested) {
        const nestedPath = path.join(entryPath, nestedEntry.name);
        if (nestedEntry.type === 'd') {
          usedNestedDirectories = true;
          const nestedCount = await countMediaFilesRecursive(nestedPath);
          bumpWeeklyGenreCounter(counter, nestedEntry.name, nestedCount);
          continue;
        }
        if (nestedEntry.type === '-' && isMediaFileName(nestedEntry.name)) {
          bumpWeeklyGenreCounter(counter, nestedEntry.name, 1);
        }
      }

      if (usedNestedDirectories) continue;
    }

    const genreCount = await countMediaFilesRecursive(entryPath);
    bumpWeeklyGenreCounter(counter, entry.name, genreCount);
  }

  const genres = toSortedWeeklyGenres(counter);
  const totalFiles = genres.reduce((sum, row) => sum + row.files, 0);

  return {
    generatedAt: new Date().toISOString(),
    sourceFolderPath: latestWeeklyFolder.relativePath || null,
    sourceFolderName: latestWeeklyFolder.name || null,
    totalFiles,
    genres,
    topGenres: genres.slice(0, DEFAULT_WEEKLY_TOP_GENRES),
    stale: false,
  };
};

const collectExplorerMediaFilesRecursive = async (
  folderFullPath: string,
  folderRelativePath: string,
  limit: number,
  depth = 0,
): Promise<ExplorerPreviewFileCandidate[]> => {
  if (depth > MAX_WEEKLY_SCAN_DEPTH || limit <= 0) return [];

  const entries = sortDirectoryEntriesForExplorer(
    await listDirectorySafe(folderFullPath),
  );
  const rows: ExplorerPreviewFileCandidate[] = [];

  for (const entry of entries) {
    if (rows.length >= limit) break;

    if (entry.type === '-' && isMediaFileName(entry.name)) {
      const normalizedPath = joinCatalogRelativePath(folderRelativePath, entry.name);
      rows.push({
        path: normalizedPath,
        name: entry.name,
        modification: Number(entry.modification ?? 0),
        hasTempoKey: hasTempoAndKeyInFileName(entry.name),
      });
      continue;
    }

    if (entry.type !== 'd') continue;

    const nestedFullPath = path.join(folderFullPath, entry.name);
    const nestedRelativePath = joinCatalogRelativePath(
      folderRelativePath,
      entry.name,
    );
    const nestedRows = await collectExplorerMediaFilesRecursive(
      nestedFullPath,
      nestedRelativePath,
      limit - rows.length,
      depth + 1,
    );
    rows.push(...nestedRows);
  }

  return rows;
};

const getExplorerFolderFromLatestWeekly = async (
  weeklyFolder: WeeklyFolderCandidate,
): Promise<ExplorerPreviewFolderCandidate | null> => {
  const weeklyEntries = await listDirectorySafe(weeklyFolder.fullPath);
  const candidates: ExplorerPreviewFolderCandidate[] = [];
  let rootMediaFiles = 0;

  for (const entry of weeklyEntries) {
    if (entry.type === '-' && isMediaFileName(entry.name)) {
      rootMediaFiles += 1;
      continue;
    }

    if (entry.type !== 'd') continue;

    const entryFullPath = path.join(weeklyFolder.fullPath, entry.name);
    const entryRelativePath = joinCatalogRelativePath(
      weeklyFolder.relativePath,
      entry.name,
    );

    if (GENERIC_WEEK_BUCKET_REGEX.test(entry.name)) {
      const nestedEntries = await listDirectorySafe(entryFullPath);
      let hasNestedDirectories = false;

      for (const nestedEntry of nestedEntries) {
        if (nestedEntry.type !== 'd') continue;
        hasNestedDirectories = true;
        const nestedFullPath = path.join(entryFullPath, nestedEntry.name);
        const nestedRelativePath = joinCatalogRelativePath(
          entryRelativePath,
          nestedEntry.name,
        );
        const nestedCount = await countMediaFilesRecursive(nestedFullPath);
        if (nestedCount <= 0) continue;

        candidates.push({
          fullPath: nestedFullPath,
          relativePath: nestedRelativePath,
          name: nestedEntry.name,
          fileCount: nestedCount,
          modification: Number(
            nestedEntry.modification ?? entry.modification ?? 0,
          ),
        });
      }

      if (hasNestedDirectories) continue;
    }

    const fileCount = await countMediaFilesRecursive(entryFullPath);
    if (fileCount <= 0) continue;
    candidates.push({
      fullPath: entryFullPath,
      relativePath: entryRelativePath,
      name: entry.name,
      fileCount,
      modification: Number(entry.modification ?? 0),
    });
  }

  if (candidates.length > 0) {
    candidates.sort((left, right) => {
      if (right.fileCount !== left.fileCount) return right.fileCount - left.fileCount;
      if (right.modification !== left.modification) {
        return right.modification - left.modification;
      }
      return left.name.localeCompare(right.name, 'es-MX');
    });
    return candidates[0] ?? null;
  }

  if (rootMediaFiles > 0) {
    return {
      fullPath: weeklyFolder.fullPath,
      relativePath: weeklyFolder.relativePath,
      name: weeklyFolder.name,
      fileCount: rootMediaFiles,
      modification: weeklyFolder.modification,
    };
  }

  return null;
};

const buildTopDownloadsExplorerFallback = async (
  prisma: PrismaClient,
  limit: number,
): Promise<PublicExplorerPreviewSnapshot | null> => {
  const topSnapshot = await getPublicTopDownloadsCached(
    prisma,
    DEFAULT_PUBLIC_TOP_LIMIT,
    DEFAULT_PUBLIC_TOP_DAYS,
  );

  const prioritizedPool = topSnapshot.audio.length
    ? topSnapshot.audio
    : topSnapshot.video.length
      ? topSnapshot.video
      : topSnapshot.karaoke;
  if (!prioritizedPool.length) return null;

  const normalizedRows = prioritizedPool
    .map((row) => {
      const normalizedPath = normalizeCatalogRelativePath(row.path);
      if (!normalizedPath) return null;

      return {
        ...row,
        normalizedPath,
        directory: path.dirname(normalizedPath),
        hasTempoKey: hasTempoAndKeyInFileName(row.name),
      };
    })
    .filter(
      (
        row,
      ): row is TopDownloadItem & {
        normalizedPath: string;
        directory: string;
        hasTempoKey: boolean;
      } => Boolean(row),
    );
  if (!normalizedRows.length) return null;

  normalizedRows.sort((left, right) => {
    if (right.downloads !== left.downloads) return right.downloads - left.downloads;
    return Date.parse(right.lastDownload) - Date.parse(left.lastDownload);
  });

  const primary = normalizedRows[0];
  const targetDirectory = primary.directory === '.' ? '' : primary.directory;
  const sameDirectoryRows = normalizedRows.filter((row) =>
    row.directory.toLowerCase() === targetDirectory.toLowerCase());

  const selectedRows = [...(sameDirectoryRows.length ? sameDirectoryRows : normalizedRows)]
    .sort((left, right) => {
      if (left.hasTempoKey !== right.hasTempoKey) {
        return Number(right.hasTempoKey) - Number(left.hasTempoKey);
      }
      if (right.downloads !== left.downloads) return right.downloads - left.downloads;
      return Date.parse(right.lastDownload) - Date.parse(left.lastDownload);
    })
    .slice(0, limit)
    .map((row) => ({
      path: row.normalizedPath,
      name: path.basename(row.normalizedPath),
    }));

  if (!selectedRows.length) return null;

  const fallbackPath = targetDirectory || path.dirname(selectedRows[0].path);
  const normalizedFallbackPath =
    fallbackPath === '.' ? '' : normalizeCatalogRelativePath(fallbackPath);

  return {
    generatedAt: new Date().toISOString(),
    sourceFolderPath: normalizedFallbackPath || null,
    sourceFolderName: toExplorerFolderName(normalizedFallbackPath),
    explorerPath: normalizedFallbackPath
      ? toExplorerPathSegments(normalizedFallbackPath)
      : [],
    files: selectedRows,
    stale: false,
  };
};

const buildPublicExplorerPreviewSnapshot = async (
  prisma: PrismaClient,
  limit: number,
): Promise<PublicExplorerPreviewSnapshot> => {
  const cappedLimit = Math.min(
    MAX_PUBLIC_EXPLORER_PREVIEW_LIMIT,
    Math.max(1, Math.floor(limit)),
  );
  const songsBasePath = `${process.env.SONGS_PATH ?? ''}`.trim();

  if (songsBasePath) {
    const weeklyFolder = await getLatestWeeklyFolderCandidate(songsBasePath);
    if (weeklyFolder) {
      const selectedFolder = await getExplorerFolderFromLatestWeekly(weeklyFolder);
      if (selectedFolder) {
        const rawRows = await collectExplorerMediaFilesRecursive(
          selectedFolder.fullPath,
          selectedFolder.relativePath,
          Math.max(cappedLimit * 2, cappedLimit),
        );

        const selectedRows = [...rawRows]
          .sort((left, right) => {
            if (left.hasTempoKey !== right.hasTempoKey) {
              return Number(right.hasTempoKey) - Number(left.hasTempoKey);
            }
            if (right.modification !== left.modification) {
              return right.modification - left.modification;
            }
            return left.name.localeCompare(right.name, 'es-MX');
          })
          .slice(0, cappedLimit)
          .map((row) => ({
            path: row.path,
            name: row.name,
          }));

        if (selectedRows.length > 0) {
          return {
            generatedAt: new Date().toISOString(),
            sourceFolderPath: selectedFolder.relativePath,
            sourceFolderName: selectedFolder.name,
            explorerPath: toExplorerPathSegments(selectedFolder.relativePath),
            files: selectedRows,
            stale: false,
          };
        }
      }
    }
  }

  const fallback = await buildTopDownloadsExplorerFallback(prisma, cappedLimit);
  if (fallback) return fallback;
  return createEmptyExplorerPreviewSnapshot();
};

const createDemoFileName = (catalogPath: string, kind: TopDownloadKind): string => {
  // Force browser-friendly demo formats:
  // - audio: mp3
  // - video/karaoke: mp4 (h264/aac)
  const ext = kind === 'audio' ? '.mp3' : '.mp4';
  const originalExt = path.extname(catalogPath) || ext;
  const base = path
    .basename(catalogPath, originalExt)
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .slice(0, 72);
  const digest = createHash('md5').update(catalogPath).digest('hex').slice(0, 12);
  return `${base}-${digest}${ext}`;
};

const generateDemo = (
  filePath: string,
  duration: number,
  outputPath: string,
  kind: TopDownloadKind,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const command = Ffmpeg({
      logger: console,
    })
      .input(filePath)
      .inputOptions(['-ss 0'])
      .outputOptions([`-t ${duration}`]);

    if (kind === 'audio') {
      command
        .noVideo()
        .audioCodec('libmp3lame')
        .audioBitrate('128k')
        .format('mp3');
    } else {
      command
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions(['-movflags +faststart', '-preset veryfast', '-crf 28', '-pix_fmt yuv420p'])
        .format('mp4');
    }

    command.output(outputPath);

    command.on('end', () => {
      resolve();
    });

    command.on('error', (error) => {
      log.error(`[PUBLIC_TOP_DEMOS] Error while generating demo: ${error}`);
      reject(error);
    });

    command.run();
  });

const getTopDownloadsByKind = async (
  prisma: PrismaClient,
  kind: TopDownloadKind,
  limit: number,
  sinceDays: number,
): Promise<TopDownloadItem[]> => {
  const extensions = getExtensionsForKind(kind);
  const typeSql = Prisma.sql`AND (${Prisma.join(
    extensions.map((extension) =>
      Prisma.sql`LOWER(dh.fileName) LIKE ${`%${extension}`}`,
    ),
    ' OR ',
  )})`;
  const sinceDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const sinceSql = sinceDays > 0 ? Prisma.sql`AND dh.date >= ${sinceDate}` : Prisma.empty;

  const query = Prisma.sql`
    SELECT
      dh.fileName AS fileName,
      COUNT(*) AS downloads,
      MAX(dh.date) AS lastDownload,
      SUM(dh.size) AS totalBytes
    FROM download_history dh
    WHERE dh.isFolder = 0
      AND dh.fileName IS NOT NULL
      AND dh.fileName <> ''
      ${typeSql}
      ${sinceSql}
    GROUP BY dh.fileName
    ORDER BY downloads DESC, lastDownload DESC
    LIMIT ${limit};
  `;

  const rows = await prisma.$queryRaw<TopDownloadRow[]>(query);

  return rows
    .map((row) => {
      const normalizedPath = normalizeCatalogPath(row.fileName);
      const rowKind = getKindFromPath(normalizedPath);
      if (!normalizedPath || rowKind !== kind) {
        return null;
      }
      const totalBytes = Number(row.totalBytes ?? 0);

      return {
        path: normalizedPath,
        name: path.basename(normalizedPath),
        type: kind,
        downloads: Number(row.downloads ?? 0),
        totalGb: totalBytes / (1024 * 1024 * 1024),
        lastDownload: new Date(row.lastDownload).toISOString(),
      } as TopDownloadItem;
    })
    .filter((item): item is TopDownloadItem => item !== null);
};

const getTopDownloadsRollup = async (
  prisma: PrismaClient,
  category: TopDownloadCategory,
  limit: number,
  sinceDays: number,
): Promise<TopDownloadItem[]> => {
  const sinceDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const sinceDay = toUtcDay(sinceDate);
  const sinceSql = sinceDays > 0 ? Prisma.sql`AND r.day >= ${sinceDay}` : Prisma.empty;

  const query = Prisma.sql`
    SELECT
      r.fileName AS fileName,
      SUM(r.downloads) AS downloads,
      MAX(r.lastDownload) AS lastDownload,
      SUM(r.totalBytes) AS totalBytes
    FROM download_history_rollup_daily r
    WHERE r.category = ${category}
      AND r.fileName IS NOT NULL
      AND r.fileName <> ''
      ${sinceSql}
    GROUP BY r.fileName
    ORDER BY downloads DESC, lastDownload DESC
    LIMIT ${limit};
  `;

  const rows = await prisma.$queryRaw<TopDownloadRow[]>(query);

  return rows
    .map((row) => {
      const normalizedPath = normalizeCatalogPath(row.fileName);
      const rowKind = getKindFromPath(normalizedPath);
      if (!normalizedPath || !rowKind) {
        return null;
      }

      if (category === 'audio' || category === 'video') {
        if (rowKind !== category) {
          return null;
        }
      }

      const totalBytes = Number(row.totalBytes ?? 0);

      return {
        path: normalizedPath,
        name: path.basename(normalizedPath),
        type: category,
        downloads: Number(row.downloads ?? 0),
        totalGb: totalBytes / (1024 * 1024 * 1024),
        lastDownload: new Date(row.lastDownload).toISOString(),
      } as TopDownloadItem;
    })
    .filter((item): item is TopDownloadItem => item !== null);
};

const isPublicTopRollupReady = async (
  prisma: PrismaClient,
  sinceDays: number,
): Promise<boolean> => {
  if (sinceDays <= 0) {
    return false;
  }

  const sinceDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const sinceDay = toUtcDay(sinceDate);

  try {
    const rows = await prisma.$queryRaw<RollupCoverageRow[]>(Prisma.sql`
      SELECT category, MIN(day) AS minDay
      FROM download_history_rollup_daily
      WHERE category IN ('audio', 'video', 'karaoke')
      GROUP BY category;
    `);

    const minDayByCategory = new Map<string, Date>();
    for (const row of rows) {
      if (!row?.category || !row?.minDay) continue;
      const parsed = new Date(row.minDay);
      if (!Number.isNaN(parsed.getTime())) {
        minDayByCategory.set(row.category, parsed);
      }
    }

    return (['audio', 'video', 'karaoke'] as const).every((category) => {
      const minDay = minDayByCategory.get(category);
      return Boolean(minDay && minDay.getTime() <= sinceDay.getTime());
    });
  } catch {
    return false;
  }
};

const getTopDownloadsKaraoke = async (
  prisma: PrismaClient,
  limit: number,
  sinceDays: number,
): Promise<TopDownloadItem[]> => {
  const extensions = getAllMediaExtensions();
  const typeSql = Prisma.sql`AND (${Prisma.join(
    extensions.map((extension) =>
      Prisma.sql`LOWER(dh.fileName) LIKE ${`%${extension}`}`,
    ),
    ' OR ',
  )})`;

  const karaokeSql = Prisma.sql`AND (
    LOWER(dh.fileName) LIKE '%/karaoke/%'
    OR LOWER(dh.fileName) LIKE '%/karaokes/%'
    OR LOWER(dh.fileName) LIKE 'karaoke/%'
    OR LOWER(dh.fileName) LIKE 'karaokes/%'
  )`;

  const sinceDate = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  const sinceSql = sinceDays > 0 ? Prisma.sql`AND dh.date >= ${sinceDate}` : Prisma.empty;

  const query = Prisma.sql`
    SELECT
      dh.fileName AS fileName,
      COUNT(*) AS downloads,
      MAX(dh.date) AS lastDownload,
      SUM(dh.size) AS totalBytes
    FROM download_history dh
    WHERE dh.isFolder = 0
      AND dh.fileName IS NOT NULL
      AND dh.fileName <> ''
      ${typeSql}
      ${karaokeSql}
      ${sinceSql}
    GROUP BY dh.fileName
    ORDER BY downloads DESC, lastDownload DESC
    LIMIT ${limit};
  `;

  const rows = await prisma.$queryRaw<TopDownloadRow[]>(query);

  return rows
    .map((row) => {
      const normalizedPath = normalizeCatalogPath(row.fileName);
      const rowKind = getKindFromPath(normalizedPath);
      if (!normalizedPath || !rowKind) {
        return null;
      }
      const totalBytes = Number(row.totalBytes ?? 0);

      return {
        path: normalizedPath,
        name: path.basename(normalizedPath),
        type: 'karaoke',
        downloads: Number(row.downloads ?? 0),
        totalGb: totalBytes / (1024 * 1024 * 1024),
        lastDownload: new Date(row.lastDownload).toISOString(),
      } as TopDownloadItem;
    })
    .filter((item): item is TopDownloadItem => item !== null);
};

type PublicTopDownloadsSnapshot = {
  limit: number;
  sinceDays: number;
  generatedAt: string;
  audio: TopDownloadItem[];
  video: TopDownloadItem[];
  karaoke: TopDownloadItem[];
};

const PUBLIC_TOP_CACHE_TTL_MS = 5 * 60 * 1000;
const publicTopCache = new Map<
  string,
  {
    cachedAt: number;
    data: PublicTopDownloadsSnapshot | null;
    inFlight: Promise<PublicTopDownloadsSnapshot> | null;
  }
>();

const getPublicTopCacheKey = (limit: number, sinceDays: number): string =>
  `${limit}:${sinceDays}`;

const getPublicTopDownloadsCached = async (
  prisma: PrismaClient,
  limit: number,
  sinceDays: number,
): Promise<PublicTopDownloadsSnapshot> => {
  const key = getPublicTopCacheKey(limit, sinceDays);
  const now = Date.now();
  const existing = publicTopCache.get(key);
  if (existing?.data && now - existing.cachedAt < PUBLIC_TOP_CACHE_TTL_MS) {
    return existing.data;
  }
  if (existing?.inFlight) {
    return existing.inFlight;
  }

  const refreshPromise = (async () => {
    const canUseRollup = await isPublicTopRollupReady(prisma, sinceDays);
    const [audio, video, karaoke] = canUseRollup
      ? await Promise.all([
          getTopDownloadsRollup(prisma, 'audio', limit, sinceDays),
          getTopDownloadsRollup(prisma, 'video', limit, sinceDays),
          getTopDownloadsRollup(prisma, 'karaoke', limit, sinceDays),
        ])
      : await Promise.all([
          getTopDownloadsByKind(prisma, 'audio', limit, sinceDays),
          getTopDownloadsByKind(prisma, 'video', limit, sinceDays),
          getTopDownloadsKaraoke(prisma, limit, sinceDays),
        ]);

    const snapshot: PublicTopDownloadsSnapshot = {
      limit,
      sinceDays,
      generatedAt: new Date().toISOString(),
      audio,
      video,
      karaoke,
    };

    publicTopCache.set(key, {
      cachedAt: Date.now(),
      data: snapshot,
      inFlight: null,
    });

    return snapshot;
  })();

  // Stale-while-revalidate: if we have stale data, return it immediately and refresh in the background.
  if (existing?.data) {
    publicTopCache.set(key, {
      cachedAt: existing.cachedAt,
      data: existing.data,
      inFlight: refreshPromise.finally(() => {
        const current = publicTopCache.get(key);
        if (current?.inFlight) {
          publicTopCache.set(key, {
            cachedAt: current.cachedAt,
            data: current.data,
            inFlight: null,
          });
        }
      }),
    });
    return existing.data;
  }

  publicTopCache.set(key, {
    cachedAt: 0,
    data: null,
    inFlight: refreshPromise,
  });

  try {
    return await refreshPromise;
  } finally {
    const current = publicTopCache.get(key);
    if (current?.inFlight) {
      publicTopCache.set(key, {
        cachedAt: current.cachedAt,
        data: current.data,
        inFlight: null,
      });
    }
  }
};

let publicWeeklyUploadsCachedAt = 0;
let publicWeeklyUploadsData: PublicWeeklyGenreUploadsSnapshot | null = null;
let publicWeeklyUploadsInFlight: Promise<PublicWeeklyGenreUploadsSnapshot> | null = null;

const getPublicWeeklyGenreUploadsCached = async (): Promise<PublicWeeklyGenreUploadsSnapshot> => {
  const now = Date.now();
  if (
    publicWeeklyUploadsData
    && now - publicWeeklyUploadsCachedAt < PUBLIC_WEEKLY_UPLOADS_CACHE_TTL_MS
  ) {
    return {
      ...publicWeeklyUploadsData,
      stale: false,
    };
  }

  if (publicWeeklyUploadsInFlight) {
    return publicWeeklyUploadsInFlight;
  }

  const refreshPromise = (async () => {
    try {
      const fresh = await buildWeeklyGenreUploadsSnapshot();
      const snapshot = {
        ...fresh,
        stale: false,
      };
      publicWeeklyUploadsData = snapshot;
      publicWeeklyUploadsCachedAt = Date.now();
      return snapshot;
    } catch (error) {
      log.warn(
        `[PUBLIC_WEEKLY_UPLOADS] Snapshot refresh failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      if (publicWeeklyUploadsData) {
        return {
          ...publicWeeklyUploadsData,
          stale: true,
        };
      }
      return createEmptyWeeklyUploadsSnapshot();
    }
  })();

  publicWeeklyUploadsInFlight = refreshPromise.finally(() => {
    publicWeeklyUploadsInFlight = null;
  });

  if (publicWeeklyUploadsData) {
    return {
      ...publicWeeklyUploadsData,
      stale: true,
    };
  }

  return refreshPromise;
};

const publicExplorerPreviewCache = new Map<
  string,
  {
    cachedAt: number;
    data: PublicExplorerPreviewSnapshot | null;
    inFlight: Promise<PublicExplorerPreviewSnapshot> | null;
  }
>();

const getPublicExplorerPreviewCacheKey = (limit: number): string => `${limit}`;

const getPublicExplorerPreviewCached = async (
  prisma: PrismaClient,
  limit: number,
): Promise<PublicExplorerPreviewSnapshot> => {
  const key = getPublicExplorerPreviewCacheKey(limit);
  const now = Date.now();
  const existing = publicExplorerPreviewCache.get(key);
  if (
    existing?.data
    && now - existing.cachedAt < PUBLIC_EXPLORER_PREVIEW_CACHE_TTL_MS
  ) {
    return existing.data;
  }
  if (existing?.inFlight) return existing.inFlight;

  const refreshPromise = (async () => {
    try {
      const fresh = await buildPublicExplorerPreviewSnapshot(prisma, limit);
      const snapshot: PublicExplorerPreviewSnapshot = {
        ...fresh,
        stale: false,
      };

      publicExplorerPreviewCache.set(key, {
        cachedAt: Date.now(),
        data: snapshot,
        inFlight: null,
      });

      return snapshot;
    } catch (error) {
      log.warn(
        `[PUBLIC_EXPLORER_PREVIEW] Snapshot refresh failed: ${
          error instanceof Error ? error.message : 'unknown error'
        }`,
      );
      if (existing?.data) {
        return {
          ...existing.data,
          stale: true,
        };
      }
      return createEmptyExplorerPreviewSnapshot();
    }
  })();

  if (existing?.data) {
    publicExplorerPreviewCache.set(key, {
      cachedAt: existing.cachedAt,
      data: existing.data,
      inFlight: refreshPromise.finally(() => {
        const current = publicExplorerPreviewCache.get(key);
        if (current?.inFlight) {
          publicExplorerPreviewCache.set(key, {
            cachedAt: current.cachedAt,
            data: current.data,
            inFlight: null,
          });
        }
      }),
    });
    return {
      ...existing.data,
      stale: true,
    };
  }

  publicExplorerPreviewCache.set(key, {
    cachedAt: 0,
    data: null,
    inFlight: refreshPromise,
  });

  try {
    return await refreshPromise;
  } finally {
    const current = publicExplorerPreviewCache.get(key);
    if (current?.inFlight) {
      publicExplorerPreviewCache.set(key, {
        cachedAt: current.cachedAt,
        data: current.data,
        inFlight: null,
      });
    }
  }
};

export const downloadHistoryRouter = router({
  getPublicTopDownloads: publicProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(MAX_PUBLIC_TOP_LIMIT).optional(),
          sinceDays: z.number().int().min(0).max(MAX_PUBLIC_TOP_DAYS).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const limit = input?.limit ?? DEFAULT_PUBLIC_TOP_LIMIT;
      const sinceDays = input?.sinceDays ?? DEFAULT_PUBLIC_TOP_DAYS;

      return getPublicTopDownloadsCached(prisma, limit, sinceDays);
    }),
  getPublicWeeklyGenreUploads: publicProcedure
    .input(
      z
        .object({
          top: z.number().int().min(1).max(MAX_WEEKLY_TOP_GENRES).optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const top = input?.top ?? DEFAULT_WEEKLY_TOP_GENRES;
      const snapshot = await getPublicWeeklyGenreUploadsCached();

      return {
        ...snapshot,
        topGenres: snapshot.genres.slice(0, top),
      };
    }),
  getPublicExplorerPreview: publicProcedure
    .input(
      z
        .object({
          limit: z
            .number()
            .int()
            .min(1)
            .max(MAX_PUBLIC_EXPLORER_PREVIEW_LIMIT)
            .optional(),
        })
        .optional(),
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const limit = input?.limit ?? DEFAULT_PUBLIC_EXPLORER_PREVIEW_LIMIT;
      return getPublicExplorerPreviewCached(prisma, limit);
    }),
  getPublicTopDemo: publicProcedure
    .input(
      z.object({
        path: z.string().min(3).max(500),
      }),
    )
    .query(async ({ ctx: { prisma }, input: { path: requestedPath } }) => {
      const normalizedPath = normalizeCatalogPath(requestedPath);

      if (normalizedPath.includes('..')) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Ruta no válida',
        });
      }

      const itemKind = getKindFromPath(normalizedPath);
      if (!itemKind) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Solo se permiten audios o videos para demo',
        });
      }

      const topSnapshot = await getPublicTopDownloadsCached(
        prisma,
        DEFAULT_PUBLIC_TOP_LIMIT,
        DEFAULT_PUBLIC_TOP_DAYS,
      );

      const normalizedLower = normalizedPath.toLowerCase();
      const isPathAllowed = [
        ...topSnapshot.audio,
        ...topSnapshot.video,
        ...topSnapshot.karaoke,
      ].some((item) => item.path.toLowerCase() === normalizedLower);

      if (!isPathAllowed) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Este demo no está disponible en la selección pública',
        });
      }

      const fullPath = path.join(process.env.SONGS_PATH as string, normalizedPath);
      const fileExists = await fileService.exists(fullPath);
      if (!fileExists) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No existe este archivo',
        });
      }

      const config = await prisma.config.findFirst({
        where: {
          name: 'time_demos',
        },
      });
      const demoDuration = config?.value ? Number(config.value) : 60;
      const demoFileName = createDemoFileName(normalizedPath, itemKind);
      const demoOutputPath = path.join(
        process.env.DEMOS_PATH as string,
        demoFileName,
      );
      const encodedDemoFileName = encodeURIComponent(demoFileName);

      if (!(await fileService.exists(demoOutputPath))) {
        log.info(`[PUBLIC_TOP_DEMOS] Generating demo for ${normalizedPath}`);
        try {
          await generateDemo(fullPath, demoDuration, demoOutputPath, itemKind);
        } catch (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'No pudimos preparar el demo. Reintenta en unos segundos.',
            cause: error,
          });
        }
      }

      return {
        demo: buildDemoPublicUrl(encodedDemoFileName),
        kind: itemKind,
        name: path.basename(normalizedPath),
      };
    }),
  getDownloadHistory: shieldedProcedure
    .input(
      z.object({
        skip: z.number().optional(),
        take: z.number().optional(),
        orderBy: z.any(),
        where: z
          .object({
            userId: z.number(),
          })
          .optional(),
        select: z.any(),
      }),
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const whereSql = input.where
        ? Prisma.sql`WHERE dh.userId = ${input.where.userId}`
        : Prisma.empty;

      const countQuery = Prisma.sql`SELECT COUNT(*) as totalCount
                FROM download_history dh
                INNER JOIN users u ON dh.userId = u.id
                ${whereSql}`;

      const limitOffset = input.take
        ? Prisma.sql`LIMIT ${input.take} OFFSET ${input.skip ?? 0}`
        : Prisma.empty;

      const query = Prisma.sql`SELECT dh.*, u.email, u.phone
                FROM download_history dh
                INNER JOIN users u ON dh.userId = u.id
                ${whereSql}
                ORDER BY dh.date DESC
                ${limitOffset};`;

      const count = await prisma.$queryRaw<
        Array<{ totalCount: bigint | number }>
      >(countQuery);
      const results = await prisma.$queryRaw<DownloadHistory[]>(query);

      return {
        count: Number(count[0]?.totalCount ?? 0),
        data: results,
      };
    }),
  getDownloadConsumptionDashboard: shieldedProcedure
    .input(
      z
        .object({
          days: z.number().int().min(1).max(365).optional(),
          limitUsers: z.number().int().min(1).max(200).optional(),
          limitUserDays: z.number().int().min(1).max(500).optional(),
          abuseGbPerDayThreshold: z.number().min(0).max(5000).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const days =
        typeof input?.days === 'number' && Number.isFinite(input.days)
          ? Math.max(1, Math.min(365, Math.floor(input.days)))
          : 7;
      const start = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const limitUsers =
        typeof input?.limitUsers === 'number' && Number.isFinite(input.limitUsers)
          ? Math.max(1, Math.min(200, Math.floor(input.limitUsers)))
          : 50;
      const limitUserDays =
        typeof input?.limitUserDays === 'number' && Number.isFinite(input.limitUserDays)
          ? Math.max(1, Math.min(500, Math.floor(input.limitUserDays)))
          : 120;

      const envThreshold = Number(
        (process.env.DOWNLOAD_ABUSE_GB_PER_DAY_THRESHOLD || '').trim(),
      );
      const thresholdGbPerDay =
        typeof input?.abuseGbPerDayThreshold === 'number' &&
        Number.isFinite(input.abuseGbPerDayThreshold)
          ? Math.max(0, Math.min(5000, input.abuseGbPerDayThreshold))
          : Number.isFinite(envThreshold) && envThreshold > 0
            ? envThreshold
            : 20;
      const thresholdBytes = thresholdGbPerDay * 1024 * 1024 * 1024;

      const numberFromUnknown = (value: unknown): number => {
        if (typeof value === 'bigint') return Number(value);
        if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
        if (typeof value === 'string') {
          const parsed = Number(value);
          return Number.isFinite(parsed) ? parsed : 0;
        }
        return 0;
      };

      const bytesToGb = (bytes: unknown): number => numberFromUnknown(bytes) / (1024 * 1024 * 1024);

      const [totalsRows, topUsersRows, topUserDaysRows] = await Promise.all([
        prisma.$queryRaw<
          Array<{
            downloads: bigint | number;
            totalBytes: bigint | number;
            uniqueUsers: bigint | number;
          }>
        >(Prisma.sql`
          SELECT
            COUNT(*) AS downloads,
            COALESCE(SUM(dh.size), 0) AS totalBytes,
            COUNT(DISTINCT dh.userId) AS uniqueUsers
          FROM download_history dh
          WHERE dh.date >= ${start}
        `),
        prisma.$queryRaw<
          Array<{
            userId: number;
            username: string;
            email: string;
            phone: string | null;
            downloads: bigint | number;
            totalBytes: bigint | number;
            lastDownload: Date | string | null;
          }>
        >(Prisma.sql`
          SELECT
            dh.userId AS userId,
            u.username AS username,
            u.email AS email,
            u.phone AS phone,
            COUNT(*) AS downloads,
            COALESCE(SUM(dh.size), 0) AS totalBytes,
            MAX(dh.date) AS lastDownload
          FROM download_history dh
          INNER JOIN users u
            ON u.id = dh.userId
          WHERE dh.date >= ${start}
          GROUP BY dh.userId, u.username, u.email, u.phone
          ORDER BY totalBytes DESC
          LIMIT ${limitUsers}
        `),
        prisma.$queryRaw<
          Array<{
            userId: number;
            username: string;
            email: string;
            phone: string | null;
            day: string;
            downloads: bigint | number;
            totalBytes: bigint | number;
          }>
        >(Prisma.sql`
          SELECT
            dh.userId AS userId,
            u.username AS username,
            u.email AS email,
            u.phone AS phone,
            DATE_FORMAT(dh.date, '%Y-%m-%d') AS day,
            COUNT(*) AS downloads,
            COALESCE(SUM(dh.size), 0) AS totalBytes
          FROM download_history dh
          INNER JOIN users u
            ON u.id = dh.userId
          WHERE dh.date >= ${start}
          GROUP BY dh.userId, u.username, u.email, u.phone, day
          ORDER BY totalBytes DESC
          LIMIT ${limitUserDays}
        `),
      ]);

      const totals = totalsRows[0] ?? { downloads: 0, totalBytes: 0, uniqueUsers: 0 };

      const topUsers = topUsersRows.map((row) => {
        const lastDownloadValue =
          row.lastDownload instanceof Date
            ? row.lastDownload.toISOString()
            : typeof row.lastDownload === 'string'
              ? new Date(row.lastDownload).toISOString()
              : null;
        const totalGb = bytesToGb(row.totalBytes);
        return {
          userId: Number(row.userId),
          username: row.username,
          email: row.email,
          phone: row.phone,
          downloads: numberFromUnknown(row.downloads),
          totalBytes: numberFromUnknown(row.totalBytes),
          totalGb,
          lastDownload: lastDownloadValue,
        };
      });

      const topUserDays = topUserDaysRows.map((row) => {
        const totalGb = bytesToGb(row.totalBytes);
        return {
          userId: Number(row.userId),
          username: row.username,
          email: row.email,
          phone: row.phone,
          day: row.day,
          downloads: numberFromUnknown(row.downloads),
          totalBytes: numberFromUnknown(row.totalBytes),
          totalGb,
        };
      });

      const alerts = topUserDays
        .filter((row) => numberFromUnknown(row.totalBytes) >= thresholdBytes)
        .slice(0, 100)
        .map((row) => ({
          ...row,
          thresholdGbPerDay,
        }));

      return {
        range: {
          days,
          start: start.toISOString(),
          end: new Date().toISOString(),
        },
        thresholdGbPerDay,
        totals: {
          downloads: numberFromUnknown(totals.downloads),
          totalBytes: numberFromUnknown(totals.totalBytes),
          totalGb: bytesToGb(totals.totalBytes),
          uniqueUsers: numberFromUnknown(totals.uniqueUsers),
        },
        topUsers,
        topUserDays,
        alerts,
      };
    }),
  getRemainingGigas: shieldedProcedure
    .input(
      z.object({
        userId: z.number(),
      }),
    )
    .query(async ({ ctx: { prisma }, input }) => {
      const ftpAccounts = await prisma.ftpUser.findMany({
        where: {
          user_id: input.userId,
        },
      });

      const regularFtpUser = ftpAccounts.find(
        (ftpAccount) => !ftpAccount.userid.endsWith(extendedAccountPostfix),
      );

      if (ftpAccounts.length === 0 || !regularFtpUser) {
        return { remaining: 0 };
      }

      const quotaTallies = await prisma.ftpquotatallies.findFirst({
        where: {
          name: regularFtpUser.userid,
        },
      });

      const quotaLimits = await prisma.ftpQuotaLimits.findFirst({
        where: {
          name: regularFtpUser.userid,
        },
      });

      if (!quotaLimits || !quotaTallies) {
        return { remaining: 0 };
      }

      const availableBytes = quotaLimits.bytes_out_avail - quotaTallies.bytes_out_used;
      const availableGigas = Number(availableBytes) / (1024 * 1024 * 1024);
      return { remaining: availableGigas };
    }),
});
