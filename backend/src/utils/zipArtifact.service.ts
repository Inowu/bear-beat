import crypto from 'crypto';
import fs from 'fs';
import Path from 'path';
import { addDays, subDays } from 'date-fns';
import type { PrismaClient, compressed_dir_artifacts } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { resolvePathWithinRoot } from './safePaths';

export type ZipArtifactTier = 'hot' | 'warm';
export type ZipArtifactStatus = 'ready' | 'building' | 'failed';

type ZipArtifactLookupParams = {
  folderPathNormalized: string;
  versionKey: string;
};

type UpsertReadyParams = ZipArtifactLookupParams & {
  zipName: string;
  zipSizeBytes: number | bigint;
  sourceSizeBytes: number | bigint;
  tier: ZipArtifactTier;
};

type MarkBuildingParams = ZipArtifactLookupParams & {
  zipName: string;
  sourceSizeBytes: number | bigint;
  tier: ZipArtifactTier;
};

type MarkFailedParams = ZipArtifactLookupParams & {
  zipName: string;
  sourceSizeBytes: number | bigint;
  tier: ZipArtifactTier;
  error: string;
};

type UploadPublishParams = {
  sourceZipPath: string;
  targetZipName: string;
};

type PrewarmCandidateConfig = {
  topWindowDays: number;
  newWindowDays: number;
};

export type ZipArtifactConfig = {
  hotTtlDays: number;
  warmTtlDays: number;
  diskFraction: number;
  prewarmIntervalMinutes: number;
  prewarmConcurrency: number;
  prewarmTopWindowDays: number;
  prewarmNewWindowDays: number;
};

export type DownloadDirUrlParts = {
  dirName: string | null;
  jobId: string | null;
  artifactId: number | null;
};

const DEFAULT_HOT_TTL_DAYS = 90;
const DEFAULT_WARM_TTL_DAYS = 14;
const DEFAULT_DISK_FRACTION = 0.25;
const DEFAULT_PREWARM_INTERVAL_MINUTES = 15;
const DEFAULT_PREWARM_CONCURRENCY = 2;
const DEFAULT_PREWARM_TOP_WINDOW_DAYS = 30;
const DEFAULT_PREWARM_NEW_WINDOW_DAYS = 180;
const DEFAULT_ZIP_COMPRESSION_LEVEL = 1;
const SHARED_ARTIFACTS_DIRNAME = 'shared';

const parsePositiveInt = (
  rawValue: string | undefined,
  fallback: number,
): number => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const parseDiskFraction = (rawValue: string | undefined, fallback: number): number => {
  const parsed = Number(rawValue);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  if (parsed > 1) return 1;
  return parsed;
};

const toBigIntBytes = (value: number | bigint): bigint => {
  if (typeof value === 'bigint') {
    return value >= BigInt(0) ? value : BigInt(0);
  }
  if (!Number.isFinite(value)) return BigInt(0);
  return BigInt(Math.max(0, Math.floor(value)));
};

const normalizeBigIntCount = (value: unknown): bigint => {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    return BigInt(Math.max(0, Math.floor(value)));
  }
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return BigInt(Math.max(0, Math.floor(parsed)));
    }
  }
  return BigInt(0);
};

export const getZipArtifactConfig = (): ZipArtifactConfig => ({
  hotTtlDays: parsePositiveInt(
    process.env.ZIP_ARTIFACT_HOT_TTL_DAYS,
    DEFAULT_HOT_TTL_DAYS,
  ),
  warmTtlDays: parsePositiveInt(
    process.env.ZIP_ARTIFACT_WARM_TTL_DAYS,
    DEFAULT_WARM_TTL_DAYS,
  ),
  diskFraction: parseDiskFraction(
    process.env.ZIP_ARTIFACT_DISK_FRACTION,
    DEFAULT_DISK_FRACTION,
  ),
  prewarmIntervalMinutes: parsePositiveInt(
    process.env.ZIP_PREWARM_INTERVAL_MINUTES,
    DEFAULT_PREWARM_INTERVAL_MINUTES,
  ),
  prewarmConcurrency: parsePositiveInt(
    process.env.ZIP_PREWARM_CONCURRENCY,
    DEFAULT_PREWARM_CONCURRENCY,
  ),
  prewarmTopWindowDays: parsePositiveInt(
    process.env.ZIP_PREWARM_TOP_WINDOW_DAYS,
    DEFAULT_PREWARM_TOP_WINDOW_DAYS,
  ),
  prewarmNewWindowDays: parsePositiveInt(
    process.env.ZIP_PREWARM_NEW_WINDOW_DAYS,
    DEFAULT_PREWARM_NEW_WINDOW_DAYS,
  ),
});

export const getZipCompressionLevel = (): number => {
  const parsedZipCompressionLevel = Number(process.env.ZIP_COMPRESSION_LEVEL);
  if (
    Number.isInteger(parsedZipCompressionLevel) &&
    parsedZipCompressionLevel >= 0 &&
    parsedZipCompressionLevel <= 9
  ) {
    return parsedZipCompressionLevel;
  }
  return DEFAULT_ZIP_COMPRESSION_LEVEL;
};

export const getCompressedDirsRoot = (): string => {
  const configured = `${process.env.COMPRESSED_DIRS_NAME ?? ''}`.trim();
  const relative = configured || 'compressed_dirs';
  return Path.isAbsolute(relative)
    ? relative
    : Path.resolve(process.cwd(), relative);
};

export const getSharedArtifactsRoot = (): string =>
  Path.resolve(getCompressedDirsRoot(), SHARED_ARTIFACTS_DIRNAME);

export const ensureSharedArtifactsRoot = async (): Promise<void> => {
  await fs.promises.mkdir(getSharedArtifactsRoot(), { recursive: true });
};

export const normalizeCatalogFolderPath = (value: string): string => {
  const raw = `${value ?? ''}`.trim().replace(/\\/g, '/');
  const noDupSlashes = raw.replace(/\/{2,}/g, '/');
  const noLeading = noDupSlashes.replace(/^\/+/, '');
  const normalized = `/${noLeading}`;
  if (normalized === '/') return normalized;
  return normalized.replace(/\/+$/, '');
};

export const stripLeadingSlash = (normalizedPath: string): string =>
  normalizeCatalogFolderPath(normalizedPath).replace(/^\/+/, '');

export const buildZipArtifactVersionKey = (params: {
  folderPathNormalized: string;
  sourceSizeBytes: number | bigint;
  dirMtimeMs: number;
}): string => {
  const folderPathNormalized = normalizeCatalogFolderPath(
    params.folderPathNormalized,
  );
  const sourceSize = toBigIntBytes(params.sourceSizeBytes);
  const mtime = Number.isFinite(params.dirMtimeMs)
    ? Math.floor(params.dirMtimeMs)
    : 0;

  const fingerprint = `${folderPathNormalized}|${sourceSize.toString()}|${mtime}`;
  return crypto.createHash('sha256').update(fingerprint).digest('hex');
};

export const buildZipArtifactZipName = (
  folderPathNormalized: string,
  versionKey: string,
): string => {
  const normalized = normalizeCatalogFolderPath(folderPathNormalized);
  const baseSegment = Path.posix.basename(normalized) || 'folder';
  const safeBase = baseSegment
    .normalize('NFKD')
    .replace(/[^\x20-\x7E]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
  const safeVersion = `${versionKey ?? ''}`
    .trim()
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 24);
  const prefix = safeBase || 'folder';
  const suffix = safeVersion || 'version';
  return `${prefix}-${suffix}.zip`;
};

export const resolveSharedZipArtifactPath = (zipName: string): string | null => {
  const trimmed = `${zipName ?? ''}`.trim();
  if (!trimmed || trimmed.includes('/') || trimmed.includes('\\')) {
    return null;
  }
  return resolvePathWithinRoot(getSharedArtifactsRoot(), trimmed);
};

const getExpirationDateForTier = (
  tier: ZipArtifactTier,
  now: Date = new Date(),
): Date => {
  const config = getZipArtifactConfig();
  const ttlDays = tier === 'hot' ? config.hotTtlDays : config.warmTtlDays;
  return addDays(now, ttlDays);
};

const parseArtifactId = (raw: string | null): number | null => {
  if (!raw) return null;
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
};

export const parseDownloadDirUrl = (
  downloadUrl: string | null | undefined,
): DownloadDirUrlParts => {
  const raw = `${downloadUrl ?? ''}`.trim();
  if (!raw) {
    return {
      dirName: null,
      jobId: null,
      artifactId: null,
    };
  }

  try {
    const parsed = new URL(raw);
    const dirNameRaw = `${parsed.searchParams.get('dirName') ?? ''}`.trim();
    const dirName =
      dirNameRaw && !dirNameRaw.includes('/') && !dirNameRaw.includes('\\')
        ? dirNameRaw
        : null;
    const jobId = `${parsed.searchParams.get('jobId') ?? ''}`.trim() || null;
    const artifactId = parseArtifactId(parsed.searchParams.get('artifactId'));

    return {
      dirName,
      jobId,
      artifactId,
    };
  } catch {
    return {
      dirName: null,
      jobId: null,
      artifactId: null,
    };
  }
};

const findByFolderAndVersion = async (
  prisma: PrismaClient,
  lookup: ZipArtifactLookupParams,
): Promise<compressed_dir_artifacts | null> =>
  prisma.compressed_dir_artifacts.findFirst({
    where: {
      folder_path_normalized: lookup.folderPathNormalized,
      version_key: lookup.versionKey,
    },
    orderBy: {
      updated_at: 'desc',
    },
  });

const saveOrUpdateArtifactRow = async (
  prisma: PrismaClient,
  params: {
    lookup: ZipArtifactLookupParams;
    createData: Omit<
      Prisma.compressed_dir_artifactsCreateInput,
      'created_at' | 'updated_at'
    >;
    updateData: Prisma.compressed_dir_artifactsUpdateInput;
  },
): Promise<compressed_dir_artifacts> => {
  const existing = await findByFolderAndVersion(prisma, params.lookup);
  if (!existing) {
    try {
      return await prisma.compressed_dir_artifacts.create({
        data: params.createData,
      });
    } catch (error: any) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const afterConflict = await findByFolderAndVersion(prisma, params.lookup);
        if (afterConflict) {
          return prisma.compressed_dir_artifacts.update({
            where: { id: afterConflict.id },
            data: params.updateData,
          });
        }
      }
      throw error;
    }
  }

  return prisma.compressed_dir_artifacts.update({
    where: { id: existing.id },
    data: params.updateData,
  });
};

export const findReadyZipArtifact = async (
  prisma: PrismaClient,
  lookup: ZipArtifactLookupParams,
): Promise<compressed_dir_artifacts | null> =>
  prisma.compressed_dir_artifacts.findFirst({
    where: {
      folder_path_normalized: lookup.folderPathNormalized,
      version_key: lookup.versionKey,
      status: 'ready',
      expires_at: {
        gt: new Date(),
      },
    },
    orderBy: {
      updated_at: 'desc',
    },
  });

export const findReadyZipArtifactById = async (
  prisma: PrismaClient,
  id: number,
): Promise<compressed_dir_artifacts | null> =>
  prisma.compressed_dir_artifacts.findFirst({
    where: {
      id,
      status: 'ready',
      expires_at: {
        gt: new Date(),
      },
    },
  });

export const touchZipArtifactAccess = async (
  prisma: PrismaClient,
  artifactId: number,
): Promise<compressed_dir_artifacts | null> => {
  const artifact = await prisma.compressed_dir_artifacts.findUnique({
    where: {
      id: artifactId,
    },
  });

  if (!artifact) return null;

  const now = new Date();
  return prisma.compressed_dir_artifacts.update({
    where: {
      id: artifact.id,
    },
    data: {
      last_accessed_at: now,
      hit_count: {
        increment: BigInt(1),
      },
      expires_at: getExpirationDateForTier(artifact.tier as ZipArtifactTier, now),
    },
  });
};

export const markZipArtifactBuilding = async (
  prisma: PrismaClient,
  params: MarkBuildingParams,
): Promise<compressed_dir_artifacts> => {
  const now = new Date();
  const sourceSizeBytes = toBigIntBytes(params.sourceSizeBytes);
  const expiresAt = getExpirationDateForTier(params.tier, now);

  return saveOrUpdateArtifactRow(prisma, {
    lookup: {
      folderPathNormalized: params.folderPathNormalized,
      versionKey: params.versionKey,
    },
    createData: {
      folder_path_normalized: params.folderPathNormalized,
      version_key: params.versionKey,
      zip_name: params.zipName,
      zip_size_bytes: BigInt(0),
      source_size_bytes: sourceSizeBytes,
      tier: params.tier,
      status: 'building',
      hit_count: BigInt(0),
      last_accessed_at: now,
      expires_at: expiresAt,
      last_error: null,
    },
    updateData: {
      zip_name: params.zipName,
      source_size_bytes: sourceSizeBytes,
      tier: params.tier,
      status: 'building',
      expires_at: expiresAt,
      last_error: null,
    },
  });
};

export const upsertZipArtifactReady = async (
  prisma: PrismaClient,
  params: UpsertReadyParams,
): Promise<compressed_dir_artifacts> => {
  const now = new Date();
  const sourceSizeBytes = toBigIntBytes(params.sourceSizeBytes);
  const zipSizeBytes = toBigIntBytes(params.zipSizeBytes);
  const expiresAt = getExpirationDateForTier(params.tier, now);

  return saveOrUpdateArtifactRow(prisma, {
    lookup: {
      folderPathNormalized: params.folderPathNormalized,
      versionKey: params.versionKey,
    },
    createData: {
      folder_path_normalized: params.folderPathNormalized,
      version_key: params.versionKey,
      zip_name: params.zipName,
      zip_size_bytes: zipSizeBytes,
      source_size_bytes: sourceSizeBytes,
      tier: params.tier,
      status: 'ready',
      hit_count: BigInt(0),
      last_accessed_at: now,
      expires_at: expiresAt,
      last_error: null,
    },
    updateData: {
      zip_name: params.zipName,
      zip_size_bytes: zipSizeBytes,
      source_size_bytes: sourceSizeBytes,
      tier: params.tier,
      status: 'ready',
      last_accessed_at: now,
      expires_at: expiresAt,
      last_error: null,
    },
  });
};

export const markZipArtifactFailed = async (
  prisma: PrismaClient,
  params: MarkFailedParams,
): Promise<compressed_dir_artifacts> => {
  const now = new Date();
  const sourceSizeBytes = toBigIntBytes(params.sourceSizeBytes);
  const expiresAt = getExpirationDateForTier(params.tier, now);

  return saveOrUpdateArtifactRow(prisma, {
    lookup: {
      folderPathNormalized: params.folderPathNormalized,
      versionKey: params.versionKey,
    },
    createData: {
      folder_path_normalized: params.folderPathNormalized,
      version_key: params.versionKey,
      zip_name: params.zipName,
      zip_size_bytes: BigInt(0),
      source_size_bytes: sourceSizeBytes,
      tier: params.tier,
      status: 'failed',
      hit_count: BigInt(0),
      last_accessed_at: now,
      expires_at: expiresAt,
      last_error: params.error,
    },
    updateData: {
      zip_name: params.zipName,
      source_size_bytes: sourceSizeBytes,
      tier: params.tier,
      status: 'failed',
      expires_at: expiresAt,
      last_error: params.error.slice(0, 2048),
    },
  });
};

export const buildArtifactDownloadUrl = (params: {
  artifactId: number;
  zipName: string;
}): string => {
  const backendUrl =
    `${process.env.BACKEND_URL ?? ''}`.trim() || 'https://thebearbeatapi.lat';
  const artifactId = Math.max(1, Math.floor(Number(params.artifactId)));
  return `${backendUrl}/download-dir?artifactId=${artifactId}&dirName=${encodeURIComponent(
    params.zipName,
  )}`;
};

const linkOrCopyFile = async (sourcePath: string, targetPath: string): Promise<void> => {
  try {
    await fs.promises.link(sourcePath, targetPath);
    return;
  } catch (error: any) {
    const recoverableCodes = new Set(['EXDEV', 'EEXIST', 'EPERM', 'EMLINK']);
    if (!recoverableCodes.has(`${error?.code ?? ''}`)) {
      throw error;
    }
  }
  await fs.promises.copyFile(sourcePath, targetPath);
};

export const publishSharedZipArtifactFile = async (
  params: UploadPublishParams,
): Promise<string> => {
  const sourceZipPath = `${params.sourceZipPath ?? ''}`.trim();
  if (!sourceZipPath) {
    throw new Error('sourceZipPath is required');
  }

  const targetPath = resolveSharedZipArtifactPath(params.targetZipName);
  if (!targetPath) {
    throw new Error('Invalid target zip name');
  }

  await ensureSharedArtifactsRoot();

  const tempTarget = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
  try {
    await fs.promises.rm(tempTarget, { force: true });
    await linkOrCopyFile(sourceZipPath, tempTarget);
    await fs.promises.rm(targetPath, { force: true });
    await fs.promises.rename(tempTarget, targetPath);
  } catch (error) {
    await fs.promises.rm(tempTarget, { force: true }).catch(() => {
      // noop
    });
    throw error;
  }

  return targetPath;
};

const getFolderPathVariants = (normalizedFolderPath: string): string[] => {
  const normalized = normalizeCatalogFolderPath(normalizedFolderPath);
  const withoutLeading = stripLeadingSlash(normalized);
  const variants = new Set<string>();
  if (withoutLeading) variants.add(withoutLeading);
  if (normalized !== '/') variants.add(normalized);
  return [...variants];
};

const getTrackPathPrefixes = (normalizedFolderPath: string): string[] => {
  const withoutLeading = stripLeadingSlash(normalizedFolderPath);
  if (!withoutLeading) return [];

  return [
    `${withoutLeading}/`,
    `/${withoutLeading}/`,
  ];
};

export const isHotZipArtifactFolder = async (
  prisma: PrismaClient,
  normalizedFolderPath: string,
  config?: PrewarmCandidateConfig,
): Promise<boolean> => {
  const now = new Date();
  const globalConfig = getZipArtifactConfig();
  const windows = {
    topWindowDays: config?.topWindowDays ?? globalConfig.prewarmTopWindowDays,
    newWindowDays: config?.newWindowDays ?? globalConfig.prewarmNewWindowDays,
  };

  const folderVariants = getFolderPathVariants(normalizedFolderPath);
  if (folderVariants.length === 0) return false;

  const topDownloadsCount = await prisma.downloadHistory.count({
    where: {
      isFolder: true,
      date: {
        gte: subDays(now, windows.topWindowDays),
      },
      fileName: {
        in: folderVariants,
      },
    },
  });

  if (topDownloadsCount > 0) {
    return true;
  }

  const trackPathPrefixes = getTrackPathPrefixes(normalizedFolderPath);
  if (trackPathPrefixes.length === 0) {
    return false;
  }

  const recentTrack = await prisma.trackMetadata.findFirst({
    where: {
      updatedAt: {
        gte: subDays(now, windows.newWindowDays),
      },
      OR: trackPathPrefixes.map((prefix) => ({
        path: {
          startsWith: prefix,
        },
      })),
    },
    select: {
      id: true,
    },
  });

  return Boolean(recentTrack?.id);
};

export const resolveZipArtifactTier = async (
  prisma: PrismaClient,
  normalizedFolderPath: string,
): Promise<ZipArtifactTier> => {
  const isHot = await isHotZipArtifactFolder(prisma, normalizedFolderPath);
  return isHot ? 'hot' : 'warm';
};

export const withDbNamedLock = async <T>(
  prisma: PrismaClient,
  lockName: string,
  task: () => Promise<T>,
): Promise<{ acquired: boolean; result: T | null }> => {
  const normalizedLockName = `${lockName ?? ''}`.trim();
  if (!normalizedLockName) {
    return { acquired: false, result: null };
  }

  const lockRows = await prisma.$queryRawUnsafe<Array<{ lockStatus: number | null }>>(
    'SELECT GET_LOCK(?, 0) AS lockStatus',
    normalizedLockName,
  );
  const lockStatus = normalizeBigIntCount(lockRows?.[0]?.lockStatus);
  if (lockStatus !== BigInt(1)) {
    return { acquired: false, result: null };
  }

  try {
    const result = await task();
    return { acquired: true, result };
  } finally {
    await prisma
      .$queryRawUnsafe<Array<{ released: number | null }>>(
        'SELECT RELEASE_LOCK(?) AS released',
        normalizedLockName,
      )
      .catch(() => {
        // noop
      });
  }
};
