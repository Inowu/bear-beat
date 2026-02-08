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
import { router } from '../trpc';
import { extendedAccountPostfix } from '../utils/constants';

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

interface TopDownloadItem {
  path: string;
  name: string;
  type: TopDownloadCategory;
  downloads: number;
  totalGb: number;
  lastDownload: string;
}

const AUDIO_EXTENSIONS = [
  '.mp3',
  '.wav',
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

const createDemoFileName = (catalogPath: string): string => {
  const ext = path.extname(catalogPath) || '.mp4';
  const base = path
    .basename(catalogPath, ext)
    .replace(/[^a-zA-Z0-9-_]/g, '_')
    .slice(0, 72);
  const digest = createHash('md5').update(catalogPath).digest('hex').slice(0, 12);
  return `${base}-${digest}${ext}`;
};

const generateDemo = (
  filePath: string,
  duration: number,
  outputPath: string,
): Promise<void> =>
  new Promise((resolve, reject) => {
    const demoVideo = Ffmpeg({
      logger: console,
    })
      .input(filePath)
      .inputOptions(['-to', `${duration}`])
      .inputOptions(['-ss 0', `-to ${duration}`])
      .videoCodec('copy')
      .audioCodec('copy')
      .output(outputPath);

    demoVideo.on('end', () => {
      resolve();
    });

    demoVideo.on('error', (error) => {
      log.error(`[PUBLIC_TOP_DEMOS] Error while generating demo: ${error}`);
      reject(error);
    });

    demoVideo.run();
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
    const [audio, video, karaoke] = await Promise.all([
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
          code: 'BAD_REQUEST',
          message: 'No existe este archivo',
        });
      }

      const config = await prisma.config.findFirst({
        where: {
          name: 'time_demos',
        },
      });
      const demoDuration = config?.value ? Number(config.value) : 60;
      const demoFileName = createDemoFileName(normalizedPath);
      const demoOutputPath = path.join(
        process.env.DEMOS_PATH as string,
        demoFileName,
      );

      if (!(await fileService.exists(demoOutputPath))) {
        log.info(`[PUBLIC_TOP_DEMOS] Generating demo for ${normalizedPath}`);
        await generateDemo(fullPath, demoDuration, demoOutputPath);
      }

      return {
        demo: `/demos/${demoFileName}`,
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
