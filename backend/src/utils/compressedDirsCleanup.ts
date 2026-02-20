import fs from 'fs';
import Path from 'path';
import { prisma } from '../db';
import { log } from '../server';
import { isSafeFileName, resolvePathWithinRoot } from './safePaths';
import { parseDownloadDirUrl } from './zipArtifact.service';
import { runZipArtifactCleanupSweep } from './zipArtifactCleanup';

type CleanupSweepResult = {
  expiredRows: number;
  deletedRows: number;
  deletedFiles: number;
  missingFiles: number;
  errors: number;
  artifactLockAcquired: boolean;
  artifactExpiredRows: number;
  artifactExpiredDeletedRows: number;
  artifactExpiredDeletedFiles: number;
  artifactExpiredMissingFiles: number;
  artifactExpiredErrors: number;
  artifactEvictedRows: number;
  artifactEvictedFiles: number;
  artifactEvictionErrors: number;
  artifactDiskBudgetBytes: bigint;
  artifactDiskUsedBytes: bigint;
};

const parseZipNameFromDownloadUrl = (downloadUrl: string | null | undefined): string | null => {
  const parsed = parseDownloadDirUrl(downloadUrl);
  return parsed.dirName && isSafeFileName(parsed.dirName) ? parsed.dirName : null;
};

const isArtifactDownloadUrl = (downloadUrl: string | null | undefined): boolean => {
  const parsed = parseDownloadDirUrl(downloadUrl);
  return Number.isInteger(parsed.artifactId) && Number(parsed.artifactId) > 0;
};

const getCompressedDirsRoot = (): string => {
  const configured = `${process.env.COMPRESSED_DIRS_NAME ?? ''}`.trim();
  const relative = configured || 'compressed_dirs';
  return Path.isAbsolute(relative)
    ? relative
    : Path.resolve(process.cwd(), relative);
};

const resolveZipName = (
  dirDownload: {
    dirName: string;
    downloadUrl: string | null;
    jobId: number | null;
    userId: number | null;
  },
  queueJobByDbId: Map<number, string>,
): string | null => {
  if (isArtifactDownloadUrl(dirDownload.downloadUrl)) {
    return null;
  }

  const fromUrl = parseZipNameFromDownloadUrl(dirDownload.downloadUrl);
  if (fromUrl) return fromUrl;

  if (!dirDownload.userId || !dirDownload.jobId) return null;
  const queueJobId = queueJobByDbId.get(dirDownload.jobId);
  if (!queueJobId) return null;

  return `${dirDownload.dirName}-${dirDownload.userId}-${queueJobId}.zip`;
};

export const runCompressedDirsCleanupSweep = async (): Promise<CleanupSweepResult> => {
  const emptyArtifactCounters = {
    artifactLockAcquired: false,
    artifactExpiredRows: 0,
    artifactExpiredDeletedRows: 0,
    artifactExpiredDeletedFiles: 0,
    artifactExpiredMissingFiles: 0,
    artifactExpiredErrors: 0,
    artifactEvictedRows: 0,
    artifactEvictedFiles: 0,
    artifactEvictionErrors: 0,
    artifactDiskBudgetBytes: BigInt(0),
    artifactDiskUsedBytes: BigInt(0),
  };

  const now = new Date();
  const expiredDownloads = await prisma.dir_downloads.findMany({
    where: {
      expirationDate: {
        lte: now,
      },
    },
    select: {
      id: true,
      dirName: true,
      downloadUrl: true,
      userId: true,
      jobId: true,
    },
    take: 500,
  });

  if (expiredDownloads.length === 0) {
    const artifactCleanup = await runZipArtifactCleanupSweep(prisma);
    return {
      expiredRows: 0,
      deletedRows: 0,
      deletedFiles: 0,
      missingFiles: 0,
      errors: 0,
      artifactLockAcquired: artifactCleanup.lockAcquired,
      artifactExpiredRows: artifactCleanup.expiredRows,
      artifactExpiredDeletedRows: artifactCleanup.expiredDeletedRows,
      artifactExpiredDeletedFiles: artifactCleanup.expiredDeletedFiles,
      artifactExpiredMissingFiles: artifactCleanup.expiredMissingFiles,
      artifactExpiredErrors: artifactCleanup.expiredErrors,
      artifactEvictedRows: artifactCleanup.evictedRows,
      artifactEvictedFiles: artifactCleanup.evictedFiles,
      artifactEvictionErrors: artifactCleanup.evictionErrors,
      artifactDiskBudgetBytes: artifactCleanup.diskBudgetBytes,
      artifactDiskUsedBytes: artifactCleanup.diskUsedBytes,
    };
  }

  const dbJobIds = expiredDownloads
    .map((download) => download.jobId)
    .filter((jobId): jobId is number => Number.isInteger(jobId));

  const jobs = dbJobIds.length
    ? await prisma.jobs.findMany({
        where: {
          id: {
            in: dbJobIds,
          },
        },
        select: {
          id: true,
          jobId: true,
        },
      })
    : [];

  const queueJobByDbId = new Map<number, string>();
  for (const job of jobs) {
    const queueJobId = `${job.jobId ?? ''}`.trim();
    if (!queueJobId) continue;
    queueJobByDbId.set(job.id, queueJobId);
  }

  const compressedRoot = getCompressedDirsRoot();
  const rowsToDelete: number[] = [];
  let deletedFiles = 0;
  let missingFiles = 0;
  let errors = 0;

  for (const download of expiredDownloads) {
    if (isArtifactDownloadUrl(download.downloadUrl)) {
      rowsToDelete.push(download.id);
      continue;
    }

    const zipName = resolveZipName(download, queueJobByDbId);
    if (!zipName || !isSafeFileName(zipName)) {
      rowsToDelete.push(download.id);
      continue;
    }

    const zipPath = resolvePathWithinRoot(compressedRoot, zipName);
    if (!zipPath) {
      rowsToDelete.push(download.id);
      continue;
    }

    try {
      fs.unlinkSync(zipPath);
      deletedFiles += 1;
      rowsToDelete.push(download.id);
    } catch (e: any) {
      if (e?.code === 'ENOENT') {
        missingFiles += 1;
        rowsToDelete.push(download.id);
      } else {
        errors += 1;
        log.warn(`[COMPRESSED_DIRS] Failed removing zip ${zipName}: ${e?.message ?? e}`);
      }
    }
  }

  if (rowsToDelete.length > 0) {
    await prisma.dir_downloads.deleteMany({
      where: {
        id: {
          in: rowsToDelete,
        },
      },
    });
  }

  let artifactCleanup;
  try {
    artifactCleanup = await runZipArtifactCleanupSweep(prisma);
  } catch (error: any) {
    log.warn(
      `[ZIP_ARTIFACT] Cleanup sweep failed: ${error?.message ?? 'unknown error'}`,
    );
    artifactCleanup = null;
  }

  return {
    expiredRows: expiredDownloads.length,
    deletedRows: rowsToDelete.length,
    deletedFiles,
    missingFiles,
    errors,
    ...(artifactCleanup
      ? {
          artifactLockAcquired: artifactCleanup.lockAcquired,
          artifactExpiredRows: artifactCleanup.expiredRows,
          artifactExpiredDeletedRows: artifactCleanup.expiredDeletedRows,
          artifactExpiredDeletedFiles: artifactCleanup.expiredDeletedFiles,
          artifactExpiredMissingFiles: artifactCleanup.expiredMissingFiles,
          artifactExpiredErrors: artifactCleanup.expiredErrors,
          artifactEvictedRows: artifactCleanup.evictedRows,
          artifactEvictedFiles: artifactCleanup.evictedFiles,
          artifactEvictionErrors: artifactCleanup.evictionErrors,
          artifactDiskBudgetBytes: artifactCleanup.diskBudgetBytes,
          artifactDiskUsedBytes: artifactCleanup.diskUsedBytes,
        }
      : emptyArtifactCounters),
  };
};
