import fs from 'fs';
import Path from 'path';
import { prisma } from '../db';
import { log } from '../server';
import { isSafeFileName, resolvePathWithinRoot } from './safePaths';

type CleanupSweepResult = {
  expiredRows: number;
  deletedRows: number;
  deletedFiles: number;
  missingFiles: number;
  errors: number;
};

const parseZipNameFromDownloadUrl = (downloadUrl: string | null | undefined): string | null => {
  const raw = `${downloadUrl ?? ''}`.trim();
  if (!raw) return null;
  try {
    const parsed = new URL(raw);
    const dirName = `${parsed.searchParams.get('dirName') ?? ''}`.trim();
    return isSafeFileName(dirName) ? dirName : null;
  } catch {
    return null;
  }
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
  const fromUrl = parseZipNameFromDownloadUrl(dirDownload.downloadUrl);
  if (fromUrl) return fromUrl;

  if (!dirDownload.userId || !dirDownload.jobId) return null;
  const queueJobId = queueJobByDbId.get(dirDownload.jobId);
  if (!queueJobId) return null;

  return `${dirDownload.dirName}-${dirDownload.userId}-${queueJobId}.zip`;
};

export const runCompressedDirsCleanupSweep = async (): Promise<CleanupSweepResult> => {
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
    return {
      expiredRows: 0,
      deletedRows: 0,
      deletedFiles: 0,
      missingFiles: 0,
      errors: 0,
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

  return {
    expiredRows: expiredDownloads.length,
    deletedRows: rowsToDelete.length,
    deletedFiles,
    missingFiles,
    errors,
  };
};
