import fs from 'fs';
import archiver from 'archiver';
import fastFolderSizeSync from 'fast-folder-size/sync';
import type { PrismaClient } from '@prisma/client';
import { log } from '../server';
import { resolvePathWithinRoot } from './safePaths';
import {
  buildZipArtifactVersionKey,
  buildZipArtifactZipName,
  ensureSharedArtifactsRoot,
  findReadyZipArtifact,
  getZipArtifactConfig,
  getZipCompressionLevel,
  markZipArtifactBuilding,
  markZipArtifactFailed,
  normalizeCatalogFolderPath,
  resolveSharedZipArtifactPath,
  stripLeadingSlash,
  upsertZipArtifactReady,
  withDbNamedLock,
} from './zipArtifact.service';

type CandidateRow = {
  folderPathNormalized: string;
  score: number;
};

export type ZipArtifactPrewarmSweepResult = {
  lockAcquired: boolean;
  candidates: number;
  attempted: number;
  built: number;
  skippedReady: number;
  skippedMissingFolder: number;
  skippedBuilding: number;
  failed: number;
};

const PREWARM_LOCK_NAME = 'zip_artifact_prewarm_v1';
const MAX_TOP_CANDIDATES = 200;
const MAX_RECENT_TRACK_ROWS = 4000;
const MAX_TOTAL_CANDIDATES = 300;

const parseDate = (value: unknown): Date | null => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(`${value}`);
  if (Number.isNaN(date.getTime())) return null;
  return date;
};

const toSafeNumber = (value: unknown): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') {
    const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
    if (value > maxSafe) return Number.MAX_SAFE_INTEGER;
    return Number(value);
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const resolveFolderFromTrackPath = (trackPath: string): string | null => {
  const normalizedTrackPath = normalizeCatalogFolderPath(trackPath);
  const relativeTrackPath = stripLeadingSlash(normalizedTrackPath);
  const lastSlash = relativeTrackPath.lastIndexOf('/');
  if (lastSlash <= 0) return null;
  const folderRelative = relativeTrackPath.slice(0, lastSlash);
  if (!folderRelative) return null;
  const folderNormalized = normalizeCatalogFolderPath(folderRelative);
  if (folderNormalized === '/') return null;
  return folderNormalized;
};

const getSongsRoot = (): string | null => {
  const raw = `${process.env.SONGS_PATH ?? ''}`.trim();
  if (!raw) return null;
  return raw;
};

const buildDirectoryZip = async (
  sourceDirPath: string,
  destinationZipPath: string,
): Promise<void> =>
  new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      reject(error instanceof Error ? error : new Error(`${error}`));
    };

    const output = fs.createWriteStream(destinationZipPath);
    const archive = archiver('zip', {
      zlib: { level: getZipCompressionLevel() },
    });

    output.on('close', () => {
      if (settled) return;
      settled = true;
      resolve();
    });

    output.on('error', fail);

    archive.on('warning', (error: any) => {
      if (error?.code === 'ENOENT') {
        log.warn(`[ZIP_PREWARM] Warning while zipping ${sourceDirPath}: ${error.message}`);
        return;
      }
      fail(error);
    });

    archive.on('error', fail);
    archive.pipe(output);
    archive.directory(sourceDirPath, false);
    void archive.finalize().catch(fail);
  });

const gatherPrewarmCandidates = async (
  prisma: PrismaClient,
): Promise<CandidateRow[]> => {
  const config = getZipArtifactConfig();
  const now = Date.now();
  const topWindowStart = new Date(now - config.prewarmTopWindowDays * 24 * 60 * 60 * 1000);
  const newWindowStart = new Date(now - config.prewarmNewWindowDays * 24 * 60 * 60 * 1000);

  const topRows = await prisma.$queryRawUnsafe<
    Array<{ folderPath: string; downloads: bigint | number | string }>
  >(
    `
      SELECT fileName AS folderPath, COUNT(*) AS downloads
      FROM download_history
      WHERE isFolder = 1 AND \`date\` >= ?
      GROUP BY fileName
      ORDER BY downloads DESC
      LIMIT ${MAX_TOP_CANDIDATES}
    `,
    topWindowStart,
  );

  const recentRows = await prisma.$queryRawUnsafe<
    Array<{ trackPath: string; updatedAt: Date | string }>
  >(
    `
      SELECT path AS trackPath, updated_at AS updatedAt
      FROM track_metadata
      WHERE updated_at >= ?
      ORDER BY updated_at DESC
      LIMIT ${MAX_RECENT_TRACK_ROWS}
    `,
    newWindowStart,
  );

  const candidateScores = new Map<string, number>();
  for (const row of topRows) {
    const folderPath = normalizeCatalogFolderPath(`${row.folderPath ?? ''}`);
    if (folderPath === '/') continue;
    const downloads = Math.max(1, Math.floor(toSafeNumber(row.downloads)));
    const score = downloads * 100;
    const previous = candidateScores.get(folderPath) ?? 0;
    candidateScores.set(folderPath, previous + score);
  }

  for (const row of recentRows) {
    const folderPath = resolveFolderFromTrackPath(`${row.trackPath ?? ''}`);
    if (!folderPath) continue;
    const updatedAt = parseDate(row.updatedAt);
    const ageDays = updatedAt
      ? Math.max(0, (now - updatedAt.getTime()) / (24 * 60 * 60 * 1000))
      : config.prewarmNewWindowDays;
    const freshnessScore = Math.max(1, Math.floor(config.prewarmNewWindowDays - ageDays));
    const previous = candidateScores.get(folderPath) ?? 0;
    candidateScores.set(folderPath, previous + freshnessScore);
  }

  return [...candidateScores.entries()]
    .map(([folderPathNormalized, score]) => ({ folderPathNormalized, score }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      return left.folderPathNormalized.localeCompare(
        right.folderPathNormalized,
        'es-MX',
      );
    })
    .slice(0, MAX_TOTAL_CANDIDATES);
};

const processPrewarmCandidate = async (
  prisma: PrismaClient,
  folderPathNormalized: string,
): Promise<'built' | 'ready' | 'missing' | 'building' | 'failed'> => {
  const songsRoot = getSongsRoot();
  if (!songsRoot) return 'missing';

  const folderRelativePath = stripLeadingSlash(folderPathNormalized);
  if (!folderRelativePath) return 'missing';

  const folderAbsolutePath = resolvePathWithinRoot(songsRoot, folderRelativePath);
  if (!folderAbsolutePath) return 'missing';

  let folderStats: fs.Stats;
  try {
    folderStats = fs.statSync(folderAbsolutePath);
  } catch {
    return 'missing';
  }

  if (!folderStats.isDirectory()) {
    return 'missing';
  }

  const sourceSizeBytes = fastFolderSizeSync(folderAbsolutePath);
  if (!sourceSizeBytes) {
    return 'missing';
  }

  const versionKey = buildZipArtifactVersionKey({
    folderPathNormalized,
    sourceSizeBytes,
    dirMtimeMs: folderStats.mtimeMs,
  });

  const existingReady = await findReadyZipArtifact(prisma, {
    folderPathNormalized,
    versionKey,
  });

  if (existingReady) {
    const existingZipPath = resolveSharedZipArtifactPath(existingReady.zip_name);
    if (existingZipPath && fs.existsSync(existingZipPath)) {
      if (existingReady.tier !== 'hot') {
        const stats = fs.statSync(existingZipPath);
        await upsertZipArtifactReady(prisma, {
          folderPathNormalized,
          versionKey,
          zipName: existingReady.zip_name,
          zipSizeBytes: stats.size,
          sourceSizeBytes,
          tier: 'hot',
        });
      }
      return 'ready';
    }
  }

  const existingBuilding = await prisma.compressed_dir_artifacts.findFirst({
    where: {
      folder_path_normalized: folderPathNormalized,
      version_key: versionKey,
      status: 'building',
    },
  });
  if (existingBuilding) return 'building';

  const zipName = buildZipArtifactZipName(folderPathNormalized, versionKey);
  const targetZipPath = resolveSharedZipArtifactPath(zipName);
  if (!targetZipPath) return 'failed';

  await markZipArtifactBuilding(prisma, {
    folderPathNormalized,
    versionKey,
    zipName,
    sourceSizeBytes,
    tier: 'hot',
  });

  const tempZipPath = `${targetZipPath}.tmp-prewarm-${process.pid}-${Date.now()}`;
  try {
    await ensureSharedArtifactsRoot();
    await buildDirectoryZip(folderAbsolutePath, tempZipPath);

    await fs.promises.rm(targetZipPath, { force: true });
    await fs.promises.rename(tempZipPath, targetZipPath);

    const zipStats = fs.statSync(targetZipPath);
    await upsertZipArtifactReady(prisma, {
      folderPathNormalized,
      versionKey,
      zipName,
      zipSizeBytes: zipStats.size,
      sourceSizeBytes,
      tier: 'hot',
    });
    return 'built';
  } catch (error: any) {
    await fs.promises.rm(tempZipPath, { force: true }).catch(() => {
      // noop
    });
    await markZipArtifactFailed(prisma, {
      folderPathNormalized,
      versionKey,
      zipName,
      sourceSizeBytes,
      tier: 'hot',
      error: `${error?.message ?? error}`,
    });
    return 'failed';
  }
};

export const runZipArtifactPrewarmSweep = async (
  prisma: PrismaClient,
): Promise<ZipArtifactPrewarmSweepResult> => {
  const emptyResult: ZipArtifactPrewarmSweepResult = {
    lockAcquired: false,
    candidates: 0,
    attempted: 0,
    built: 0,
    skippedReady: 0,
    skippedMissingFolder: 0,
    skippedBuilding: 0,
    failed: 0,
  };

  const lock = await withDbNamedLock(prisma, PREWARM_LOCK_NAME, async () => {
    const candidates = await gatherPrewarmCandidates(prisma);
    const result: ZipArtifactPrewarmSweepResult = {
      ...emptyResult,
      lockAcquired: true,
      candidates: candidates.length,
    };

    if (candidates.length === 0) {
      return result;
    }

    const config = getZipArtifactConfig();
    const concurrency = Math.max(1, Math.min(config.prewarmConcurrency, 4));
    let cursor = 0;

    await Promise.all(
      Array.from({ length: concurrency }, async () => {
        while (cursor < candidates.length) {
          const index = cursor;
          cursor += 1;
          const candidate = candidates[index];
          if (!candidate) break;

          result.attempted += 1;
          const outcome = await processPrewarmCandidate(
            prisma,
            candidate.folderPathNormalized,
          );
          if (outcome === 'built') result.built += 1;
          if (outcome === 'ready') result.skippedReady += 1;
          if (outcome === 'missing') result.skippedMissingFolder += 1;
          if (outcome === 'building') result.skippedBuilding += 1;
          if (outcome === 'failed') result.failed += 1;
        }
      }),
    );

    return result;
  });

  if (!lock.acquired || !lock.result) {
    return emptyResult;
  }
  return lock.result;
};

