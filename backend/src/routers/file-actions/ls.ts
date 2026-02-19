import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import { fileService } from '../../ftp';
import {
  enrichFilesWithTrackMetadata,
  inferTrackMetadataFromName,
  resolveChildCatalogPath,
  syncTrackMetadataForFiles,
} from '../../metadata';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import type { IFileStat } from '../../services/interfaces/fileService.interface';
import { log } from '../../server';

type LsFileRow = IFileStat & { already_downloaded?: boolean };

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

const resolveDownloadedFileSet = async (
  prisma: PrismaClient,
  userId: number,
  files: LsFileRow[],
): Promise<Set<string>> => {
  const candidatePaths = Array.from(
    new Set(
      files
        .filter((file) => file.type === '-' && typeof file.path === 'string')
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

  const rows = await prisma.downloadHistory.findMany({
    where: {
      userId,
      isFolder: false,
      fileName: {
        in: lookupPaths,
      },
    },
    select: {
      fileName: true,
    },
  });

  return new Set(
    rows
      .map((row) => normalizeDownloadHistoryPath(row.fileName))
      .filter((value) => Boolean(value)),
  );
};

const attachAlreadyDownloadedFlag = (
  files: LsFileRow[],
  downloadedPaths: Set<string>,
): LsFileRow[] =>
  files.map((file) => {
    if (file.type !== '-' || typeof file.path !== 'string') {
      return {
        ...file,
        already_downloaded: false,
      };
    }

    const normalizedPath = normalizeDownloadHistoryPath(file.path);
    return {
      ...file,
      already_downloaded: normalizedPath ? downloadedPaths.has(normalizedPath) : false,
    };
  });

export const ls = shieldedProcedure
  .input(
    z.object({
      path: z.string(),
    }),
  )
  .query(async ({ input: { path }, ctx: { prisma, session } }) => {
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
      const downloadedPaths = await resolveDownloadedFileSet(prisma, userId, rows);
      return attachAlreadyDownloadedFlag(rows, downloadedPaths);
    };

    try {
      await syncTrackMetadataForFiles(filesWithPath);
      const withMetadata = await enrichFilesWithTrackMetadata(filesWithPath);
      return withDownloadedFlag(withMetadata as LsFileRow[]);
    } catch (error: any) {
      log.warn(
        `[TRACK_METADATA] ls enrichment failed: ${error?.message ?? 'unknown error'}`,
      );
      // Fallback: still return inferred metadata so the UI can render track pills/covers
      // even if the DB migration wasn't applied or Prisma is temporarily unavailable.
      const fallbackRows = filesWithPath.map((file) => {
        if (file.type !== '-') return file;
        const inferred = inferTrackMetadataFromName(file.name);
        if (!inferred) return file;
        return {
          ...file,
          metadata: inferred,
        };
      });
      return withDownloadedFlag(fallbackRows as LsFileRow[]);
    }
  });
