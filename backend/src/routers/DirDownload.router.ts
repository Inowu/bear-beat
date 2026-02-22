import Path from 'path';
import { z } from 'zod';
import { shieldedProcedure } from '../procedures/shielded.procedure';
import { router } from '../trpc';

const AUDIO_EXTENSIONS = new Set([
  '.mp3',
  '.aac',
  '.m4a',
  '.flac',
  '.ogg',
  '.aiff',
  '.alac',
]);

const VIDEO_EXTENSIONS = new Set([
  '.mp4',
  '.mov',
  '.mkv',
  '.avi',
  '.wmv',
  '.webm',
  '.m4v',
]);

const detectDownloadKind = (
  fileName: string,
  isFolder: boolean,
): 'folder' | 'audio' | 'video' | 'file' => {
  if (isFolder) return 'folder';
  const extension = Path.extname(`${fileName ?? ''}`.toLowerCase());
  if (AUDIO_EXTENSIONS.has(extension)) return 'audio';
  if (VIDEO_EXTENSIONS.has(extension)) return 'video';
  return 'file';
};

export const dirDownloadRouter = router({
  myDownloads: shieldedProcedure
    .input(
      z
        .object({
          limit: z.number().int().min(1).max(300).optional(),
        })
        .optional(),
    )
    .query(async ({ ctx: { prisma, session }, input }) => {
      const userId = session!.user!.id;
      const limit = input?.limit ?? 120;

      const [fileDownloads, directoryDownloads] = await Promise.all([
        prisma.downloadHistory.findMany({
          where: {
            userId,
          },
          orderBy: {
            date: 'desc',
          },
          take: limit * 2,
          select: {
            id: true,
            fileName: true,
            date: true,
            size: true,
            isFolder: true,
          },
        }),
        prisma.dir_downloads.findMany({
          where: {
            userId,
          },
          orderBy: {
            date: 'desc',
          },
          take: limit * 2,
          select: {
            id: true,
            dirName: true,
            date: true,
            size: true,
          },
        }),
      ]);

      const fileRows = fileDownloads.map((row) => {
        const normalizedPath = `${row.fileName ?? ''}`.replace(/\\/g, '/').trim();
        const displayName =
          normalizedPath.split('/').filter(Boolean).pop() ||
          normalizedPath ||
          'Archivo';
        const isFolder = Boolean(row.isFolder);
        return {
          id: `file-${row.id}`,
          source: 'file' as const,
          kind: detectDownloadKind(displayName, isFolder),
          name: displayName,
          path: normalizedPath || null,
          date: row.date ?? new Date(0),
          sizeBytes:
            typeof row.size === 'bigint'
              ? Number(row.size)
              : Number.isFinite(Number(row.size))
                ? Number(row.size)
                : null,
        };
      });

      const directoryRows = directoryDownloads.map((row) => ({
        id: `dir-${row.id}`,
        source: 'dir' as const,
        kind: 'folder' as const,
        name: `${row.dirName ?? ''}`.trim() || 'Carpeta',
        path: `${row.dirName ?? ''}`.trim() || null,
        date: row.date ?? new Date(0),
        sizeBytes:
          typeof row.size === 'bigint'
            ? Number(row.size)
            : Number.isFinite(Number(row.size))
              ? Number(row.size)
              : null,
      }));

      return [...fileRows, ...directoryRows]
        .sort((left, right) => right.date.getTime() - left.date.getTime())
        .slice(0, limit);
    }),
  myDirDownloads: shieldedProcedure.query(
    async ({ ctx: { prisma, session } }) => {
      const user = session!.user!;

      const dirDownloads = await prisma.dir_downloads.findMany({
        where: {
          userId: user.id,
        },
      });

      return dirDownloads;
    },
  ),
});
