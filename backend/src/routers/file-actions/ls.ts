import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { fileService } from '../../ftp';
import {
  enrichFilesWithTrackMetadata,
  inferTrackMetadataFromName,
  resolveChildCatalogPath,
  scheduleTrackMetadataSyncForFiles,
} from '../../metadata';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import type { IFileStat } from '../../services/interfaces/fileService.interface';
import { log } from '../../server';
import { syncFtpTransferDownloadsBestEffort } from '../../utils/ftpTransferDownloadHistory';

type LsFileRow = IFileStat & { already_downloaded?: boolean };
type DownloadableRowType = '-' | 'd';
const DOWNLOAD_HISTORY_LOOKUP_BATCH = 300;

const normalizeDownloadHistoryPath = (value?: string): string => {
  const normalized = `${value ?? ''}`.trim().replace(/\\/g, '/');
  if (!normalized) return '';
  const withLeadingSlash = normalized.startsWith('/') ? normalized : `/${normalized}`;
  const collapsed = withLeadingSlash.replace(/\/{2,}/g, '/');
  if (collapsed !== '/' && collapsed.endsWith('/')) {
    return collapsed.slice(0, -1);
  }
  return collapsed;
};

const toDownloadHistoryLookupPath = (value: string): string[] => {
  const normalized = normalizeDownloadHistoryPath(value);
  if (!normalized) return [];
  const withoutLeadingSlash = normalized.replace(/^\/+/, '');
  if (!withoutLeadingSlash || withoutLeadingSlash === normalized) {
    return [normalized];
  }
  return [normalized, withoutLeadingSlash];
};

const resolveDownloadedPathSet = async (
  prisma: PrismaClient,
  userId: number,
  files: LsFileRow[],
  options: {
    rowType: DownloadableRowType;
    isFolder: boolean;
  },
): Promise<Set<string>> => {
  const candidatePaths = Array.from(
    new Set(
      files
        .filter((file) => file.type === options.rowType && typeof file.path === 'string')
        .map((file) => normalizeDownloadHistoryPath(file.path))
        .filter((value) => Boolean(value)),
    ),
  );

  if (candidatePaths.length === 0) {
    return new Set<string>();
  }

  const lookupPaths = Array.from(
    new Set(candidatePaths.flatMap((value) => toDownloadHistoryLookupPath(value))),
  );

  const rows: Array<{ fileName: string }> = [];
  for (let idx = 0; idx < lookupPaths.length; idx += DOWNLOAD_HISTORY_LOOKUP_BATCH) {
    const chunk = lookupPaths.slice(idx, idx + DOWNLOAD_HISTORY_LOOKUP_BATCH);
    if (!chunk.length) continue;

    const chunkRows = await prisma.downloadHistory.findMany({
      where: {
        userId,
        isFolder: options.isFolder,
        fileName: {
          in: chunk,
        },
      },
      select: {
        fileName: true,
      },
    });

    rows.push(...chunkRows);
  }

  return new Set(
    rows
      .map((row) => normalizeDownloadHistoryPath(row.fileName))
      .filter((value) => Boolean(value)),
  );
};

const attachAlreadyDownloadedFlag = (
  files: LsFileRow[],
  downloadedFilePaths: Set<string>,
  downloadedFolderPaths: Set<string>,
): LsFileRow[] => {
  const downloadedFolderPathsFromFiles = new Set<string>();
  downloadedFilePaths.forEach((value) => {
    const parts = value.split('/').filter((part) => part.length > 0);
    if (parts.length <= 1) return;

    const segments: string[] = [];
    for (let idx = 0; idx < parts.length - 1; idx += 1) {
      segments.push(parts[idx]);
      downloadedFolderPathsFromFiles.add(`/${segments.join('/')}`);
    }
  });

  return files.map((file) => {
    if ((file.type !== '-' && file.type !== 'd') || typeof file.path !== 'string') {
      return {
        ...file,
        already_downloaded: false,
      };
    }

    const normalizedPath = normalizeDownloadHistoryPath(file.path);
    const downloadedPaths =
      file.type === 'd'
        ? downloadedFolderPaths
        : downloadedFilePaths;
    const downloadedByNestedFile =
      file.type === 'd' && normalizedPath
        ? downloadedFolderPathsFromFiles.has(normalizedPath)
        : false;
    return {
      ...file,
      already_downloaded: normalizedPath
        ? downloadedPaths.has(normalizedPath) || downloadedByNestedFile
        : false,
    };
  });
};

const attachInferredTrackMetadata = (rows: LsFileRow[]): LsFileRow[] =>
  rows.map((file) => {
    if (file.type !== '-' || file.metadata) return file;
    const inferred = inferTrackMetadataFromName(file.name);
    if (!inferred) return file;
    return {
      ...file,
      metadata: inferred,
    };
  });

export const ls = shieldedProcedure
  .input(
    z.object({
      path: z.string(),
    }),
  )
  .query(async ({ input: { path }, ctx: { prisma, session } }) => {
    // Keep download history sync warm without adding latency to folder listing.
    void syncFtpTransferDownloadsBestEffort(prisma);

    const userId = session?.user?.id ?? null;
    const sanitizedPath = path.replace('..', '').replace('//', '/');
    const files = await fileService.list(`${process.env.SONGS_PATH}${sanitizedPath}`);
    const filesWithPath = files.map((file) => ({
      ...file,
      path: resolveChildCatalogPath(sanitizedPath, file.name),
    })) as LsFileRow[];

    const withDownloadedFlag = async (rows: LsFileRow[]): Promise<LsFileRow[]> => {
      if (!userId) {
        return rows.map((row) => ({ ...row, already_downloaded: false }));
      }
      const [downloadedFilePaths, downloadedFolderPaths] = await Promise.all([
        resolveDownloadedPathSet(prisma, userId, rows, {
          rowType: '-',
          isFolder: false,
        }),
        resolveDownloadedPathSet(prisma, userId, rows, {
          rowType: 'd',
          isFolder: true,
        }),
      ]);
      return attachAlreadyDownloadedFlag(
        rows,
        downloadedFilePaths,
        downloadedFolderPaths,
      );
    };

    try {
      scheduleTrackMetadataSyncForFiles(filesWithPath);
      const withMetadata = await enrichFilesWithTrackMetadata(filesWithPath);
      return withDownloadedFlag(attachInferredTrackMetadata(withMetadata as LsFileRow[]));
    } catch (error: any) {
      log.warn(
        `[TRACK_METADATA] ls enrichment failed: ${error?.message ?? 'unknown error'}`,
      );
      const fallbackRows = attachInferredTrackMetadata(filesWithPath);
      return withDownloadedFlag(fallbackRows as LsFileRow[]);
    }
  });
