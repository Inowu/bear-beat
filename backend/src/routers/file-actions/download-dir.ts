import { z } from 'zod';
import Path from 'path';
import pm2 from 'pm2';
import { TRPCError } from '@trpc/server';
import fs from 'fs';
import type { PrismaClient } from '@prisma/client';
import { fileService } from '../../ftp';
import { log } from '../../server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { compressionQueue } from '../../queue/compression';
import type { CompressionJob } from '../../queue/compression/types';
import { extendedAccountPostfix } from '../../utils/constants';
import { logPrefix } from '../../endpoints/download.endpoint';
import fastFolderSizeSync from 'fast-folder-size/sync';
import { JobStatus } from '../../queue/jobStatus';
import axios from 'axios';
import { isSafeFileName, resolvePathWithinRoot } from '../../utils/safePaths';
import { addDays } from 'date-fns';
import {
  buildArtifactDownloadUrl,
  buildZipArtifactVersionKey,
  findReadyZipArtifact,
  normalizeCatalogFolderPath,
  resolveSharedZipArtifactPath,
} from '../../utils/zipArtifact.service';

const getCompressedRoot = () =>
  Path.resolve(
    __dirname,
    `../../../${process.env.COMPRESSED_DIRS_NAME}`,
  );

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

const ensureTokenizedDownloadUrl = (
  downloadUrl: string,
  queueJobId: string,
  zipName: string,
): string => {
  const backendUrl = `${process.env.BACKEND_URL ?? ''}`.trim() || 'https://thebearbeatapi.lat';
  const raw = `${downloadUrl ?? ''}`.trim();
  if (!raw) {
    return `${backendUrl}/download-dir?dirName=${encodeURIComponent(
      zipName,
    )}&jobId=${encodeURIComponent(queueJobId)}`;
  }

  try {
    const parsed = new URL(raw);
    parsed.searchParams.set('dirName', zipName);
    parsed.searchParams.set('jobId', queueJobId);
    return parsed.toString();
  } catch {
    return `${backendUrl}/download-dir?dirName=${encodeURIComponent(
      zipName,
    )}&jobId=${encodeURIComponent(queueJobId)}`;
  }
};

const getFolderMtimeMs = (fullPath: string): number => {
  const stats = fs.statSync(fullPath);
  if (!stats.isDirectory()) {
    throw new Error('target_path_is_not_directory');
  }
  return stats.mtimeMs;
};

const findReusableDownload = async ({
  prisma,
  userId,
  requestPath,
  dirSize,
}: {
  prisma: PrismaClient;
  userId: number;
  requestPath: string;
  dirSize: number;
}): Promise<{ jobId: string; downloadUrl: string } | null> => {
  const activeDownloads = await prisma.dir_downloads.findMany({
    where: {
      userId,
      dirName: Path.basename(requestPath),
      size: BigInt(dirSize),
      expirationDate: {
        gt: new Date(),
      },
      jobId: {
        not: null,
      },
    },
    orderBy: {
      date: 'desc',
    },
    take: 15,
  });

  if (activeDownloads.length === 0) {
    return null;
  }

  const compressedRoot = getCompressedRoot();

  for (const candidate of activeDownloads) {
    if (!candidate.jobId) continue;

    const dbJob = await prisma.jobs.findFirst({
      where: {
        id: candidate.jobId,
        user_id: userId,
        queue: process.env.COMPRESSION_QUEUE_NAME as string,
        status: JobStatus.COMPLETED,
      },
    });

    if (!dbJob?.jobId) {
      continue;
    }

    const queueJob = await compressionQueue.getJob(dbJob.jobId);
    const queuePath = `${queueJob?.data?.songsRelativePath ?? ''}`.trim();
    if (!queuePath || queuePath !== requestPath) {
      continue;
    }

    const queueJobId = `${dbJob.jobId}`.trim();
    const expectedSuffix = `-${userId}-${queueJobId}.zip`;
    const fromUrl = parseZipNameFromDownloadUrl(candidate.downloadUrl);
    const fallbackZip = `${Path.basename(requestPath)}-${userId}-${queueJobId}.zip`;
    const zipName = fromUrl ?? fallbackZip;
    if (!isSafeFileName(zipName) || !zipName.endsWith(expectedSuffix)) {
      continue;
    }

    const zipPath = resolvePathWithinRoot(compressedRoot, zipName);
    if (!zipPath) {
      continue;
    }

    const zipExists = await fileService.exists(zipPath);
    if (!zipExists) {
      continue;
    }

    return {
      jobId: queueJobId,
      downloadUrl: ensureTokenizedDownloadUrl(
        `${candidate.downloadUrl ?? ''}`,
        queueJobId,
        zipName,
      ),
    };
  }

  return null;
};

export const downloadDir = shieldedProcedure
  .input(
    z.object({
      path: z.string(),
    }),
  )
  .query(async ({ input: { path }, ctx: { prisma, session } }) => {
    const user = session!.user!;
    const dbUser = await prisma.users.findFirst({
      where: { id: user.id },
      select: { verified: true },
    });

    if (!dbUser?.verified) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Debes verificar tu WhatsApp antes de descargar',
      });
    }

    const fullPath = `${process.env.SONGS_PATH}${path}`;
    const fileExists = await fileService.exists(fullPath);

    if (!fileExists) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Esa carpeta no existe',
      });
    }

    const dirSize = fastFolderSizeSync(fullPath);

    if (!dirSize) {
      log.error(`[STORAGE] Couldn't calculate folder size for ${fullPath}`);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Ocurrió un error al calcular el tamaño de la carpeta',
      });
    }
    let sourceDirMtimeMs: number;
    try {
      sourceDirMtimeMs = getFolderMtimeMs(fullPath);
    } catch {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Esa carpeta no existe',
      });
    }

    const folderPathNormalized = normalizeCatalogFolderPath(path);
    const sourceDirVersionKey = buildZipArtifactVersionKey({
      folderPathNormalized,
      sourceSizeBytes: dirSize,
      dirMtimeMs: sourceDirMtimeMs,
    });

    const activePlans = await prisma.descargasUser.findMany({
      where: {
        AND: [
          {
            date_end: {
              gte: new Date(),
            },
          },
          {
            user_id: user?.id,
          },
        ],
      },
      orderBy: {
        date_end: 'desc',
      },
      take: 1,
    });

    const ftpAccounts = await prisma.ftpUser.findMany({
      where: {
        user_id: user?.id,
      },
    });

    let regularFtpUser = ftpAccounts.find(
      (ftpAccount) => !ftpAccount.userid.endsWith(extendedAccountPostfix),
    );

    let useExtendedAccount = false;

    if (ftpAccounts.length === 0 || !regularFtpUser) {
      log.error('[DOWNLOAD] This user does not have an ftp user');

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Este usuario no tiene una cuenta FTP',
      });
    }

    const extendedAccount = ftpAccounts.find((ftpAccount) =>
      ftpAccount.userid.endsWith(extendedAccountPostfix),
    );

    if (activePlans.length === 0 && !extendedAccount) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Este usuario no tiene un plan activo',
      });
    }

    let quotaTallies = await prisma.ftpquotatallies.findFirst({
      where: {
        name: regularFtpUser.userid,
      },
    });

    let quotaLimits = await prisma.ftpQuotaLimits.findFirst({
      where: {
        name: regularFtpUser.userid,
      },
    });

    if (!quotaLimits || !quotaTallies) {
      log.error(
        `${logPrefix(useExtendedAccount)} This user does not have quotas`,
      );

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No hay quotas activas para este usuario',
      });
    }

    const availableBytesRegular =
      quotaLimits.bytes_out_avail - quotaTallies.bytes_out_used;

    // Use extended account when:
    // 1) user has no active plan (only extra GB should allow downloads), OR
    // 2) regular quota is not enough for this specific folder download.
    if (extendedAccount) {
      const shouldUseExtended =
        activePlans.length === 0 || availableBytesRegular < BigInt(dirSize);

      if (shouldUseExtended) {
        log.info('[DOWNLOAD] Using extended account');
        regularFtpUser = extendedAccount;
        useExtendedAccount = true;
      }
    }

    if (useExtendedAccount && extendedAccount) {
      quotaLimits = await prisma.ftpQuotaLimits.findFirst({
        where: {
          name: extendedAccount.userid,
        },
      });

      quotaTallies = await prisma.ftpquotatallies.findFirst({
        where: {
          name: extendedAccount.userid,
        },
      });
    }

    if (!quotaLimits || !quotaTallies) {
      log.error(
        `${logPrefix(useExtendedAccount)} This user does not have quotas`,
      );
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No hay quotas activas para este usuario',
      });
    }

    const availableBytes =
      quotaLimits.bytes_out_avail - quotaTallies.bytes_out_used;

    if (availableBytes < dirSize) {
      log.error(`${logPrefix(useExtendedAccount)} Not enough bytes left`, {
        availableBytes: availableBytes.toString(),
        requiredBytes: String(dirSize),
        path,
      });

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Este usuario no tiene suficientes bytes disponibles',
      });
    }

    const readyArtifact = await findReadyZipArtifact(prisma, {
      folderPathNormalized,
      versionKey: sourceDirVersionKey,
    });

    if (readyArtifact) {
      const artifactZipPath = resolveSharedZipArtifactPath(readyArtifact.zip_name);
      const artifactExists = artifactZipPath
        ? await fileService.exists(artifactZipPath)
        : false;

      if (artifactExists) {
        const downloadedAt = new Date();
        const artifactDownloadUrl = buildArtifactDownloadUrl({
          artifactId: readyArtifact.id,
          zipName: readyArtifact.zip_name,
        });

        await prisma.dir_downloads.create({
          data: {
            userId: user.id,
            date: downloadedAt,
            size: BigInt(dirSize),
            dirName: Path.basename(fullPath),
            downloadUrl: artifactDownloadUrl,
            expirationDate: addDays(downloadedAt, 1),
          },
        });

        try {
          await prisma.downloadHistory.create({
            data: {
              userId: user.id,
              size: dirSize,
              date: downloadedAt,
              fileName: path,
              isFolder: true,
            },
          });
        } catch (e: any) {
          log.warn(
            `[DOWNLOAD:DIR] Failed to write download_history on artifact hit: ${e?.message ?? e}`,
          );
        }

        await prisma.ftpquotatallies.update({
          where: {
            id: quotaTallies.id,
          },
          data: {
            bytes_out_used: {
              increment: BigInt(dirSize),
            },
          },
        });

        log.info(
          `[DOWNLOAD:DIR] Artifact cache hit for path ${path} (artifactId=${readyArtifact.id})`,
        );

        return {
          mode: 'artifact_ready' as const,
          jobId: null,
          downloadUrl: artifactDownloadUrl,
          cacheTier: readyArtifact.tier,
          reused: true,
        };
      }
    }

    const reusableDownload = await findReusableDownload({
      prisma,
      userId: user.id,
      requestPath: path,
      dirSize,
    });

    if (reusableDownload) {
      try {
        await prisma.downloadHistory.create({
          data: {
            userId: user.id,
            size: dirSize,
            date: new Date(),
            fileName: path,
            isFolder: true,
          },
        });
      } catch (e: any) {
        log.warn(
          `[DOWNLOAD:DIR] Failed to write download_history on cache hit: ${e?.message ?? e}`,
        );
      }

      await prisma.ftpquotatallies.update({
        where: {
          id: quotaTallies.id,
        },
        data: {
          bytes_out_used: {
            increment: BigInt(dirSize),
          },
        },
      });

      log.info(
        `[DOWNLOAD:DIR] Reusing existing zip for path ${path} (jobId=${reusableDownload.jobId})`,
      );

      return {
        mode: 'artifact_ready' as const,
        jobId: reusableDownload.jobId,
        downloadUrl: reusableDownload.downloadUrl,
        cacheTier: undefined,
        reused: true,
      };
    }

    // Check if server has enough storage to perform a new compression.
    try {
      const response = await axios('http://0.0.0.0:8123/');

      const {
        available_storage: availableStorage,
      }: {
        available_storage: number;
        used_storage: number;
        total_storage: number;
      } = response.data;

      const storageMargin = 40;
      if (availableStorage <= dirSize + storageMargin) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message:
            'Lo sentimos, por el momento el servidor no cuenta con suficientes recursos para realizar esta descarga',
        });
      }
    } catch (e: unknown) {
      log.error(`[STORAGE] Couldn't check os storage: ${e}`);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Ocurrió un error al iniciar la descarga',
      });
    }

    const inProgressJobs = await prisma.jobs.findMany({
      where: {
        status: JobStatus.IN_PROGRESS,
      },
    });

    if (inProgressJobs.find((job) => job.user_id === user.id)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'Ya tienes una descarga en progreso, solo se permite una descarga por usuario a la vez',
      });
    }

    if (inProgressJobs.length >= Number(process.env.MAX_CONCURRENT_DOWNLOADS)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Hay demasiadas descargas en progreso, intentalo más tarde',
      });
    }

    try {
      log.info(`[DOWNLOAD:DIR] Downloading ${path}`);

      const downloadedAt = new Date();
      const dirDownload = await prisma.dir_downloads.create({
        data: {
          userId: user.id,
          date: downloadedAt,
          size: dirSize,
          dirName: Path.basename(fullPath),
        },
      });

      try {
        await prisma.downloadHistory.create({
          data: {
            userId: user.id,
            size: dirSize,
            date: downloadedAt,
            fileName: path,
            isFolder: true,
          },
        });
      } catch (e: any) {
        log.warn(
          `[DOWNLOAD:DIR] Failed to write download_history: ${e?.message ?? e}`,
        );
      }

      const job = await compressionQueue.add(`compress-${user.id}`, {
        songsAbsolutePath: fullPath,
        songsRelativePath: path,
        folderPathNormalized,
        sourceDirMtimeMs,
        sourceDirVersionKey,
        userId: user.id,
        dirDownloadId: dirDownload.id,
        ftpAccountName:
          extendedAccount && useExtendedAccount
            ? extendedAccount.userid
            : regularFtpUser.userid,
        ftpTalliesId: quotaTallies.id,
        dirSize: Number(dirDownload.size),
        quotaTalliesId: quotaTallies.id,
      } as CompressionJob);

      log.info(`[DOWNLOAD:DIR] Added job ${job.id} to queue`);

      const dbJob = await prisma.jobs.create({
        data: {
          jobId: job.id,
          queue: process.env.COMPRESSION_QUEUE_NAME as string,
          status: JobStatus.IN_PROGRESS,
          user_id: user.id,
          createdAt: new Date(),
        },
      });

      await prisma.dir_downloads.update({
        where: {
          id: dirDownload.id,
        },
        data: {
          jobId: dbJob.id,
        },
      });

      // Pre-update the bytes used and update it back later if the job fails
      // This is necessary so the user cannot use more bytes than they have
      log.info('[DOWNLOAD:DIR] Pre-updating bytes used');
      await prisma.ftpquotatallies.update({
        where: {
          id: quotaTallies.id,
        },
        data: {
          bytes_out_used: {
            increment: BigInt(dirSize),
          },
        },
      });

      log.info(
        `[DOWNLOAD:DIR] Initiating directory compression job ${job.id}`,
      );

      try {
        const backendSseUrl = `${process.env.BACKEND_SSE_URL ?? ''}`.trim();
        if (!backendSseUrl) {
          log.warn(
            '[DOWNLOAD:DIR] BACKEND_SSE_URL is not configured. queued SSE event skipped.',
          );
        } else {
          const [waitingCount, activeCount] = await Promise.all([
            compressionQueue.getWaitingCount(),
            compressionQueue.getActiveCount(),
          ]);

          await axios.post(`${backendSseUrl}/send-event`, {
            eventName: `compression:queued:${user.id}`,
            jobId: job.id,
            progress: 0,
            queueDepth: waitingCount + activeCount,
          });
        }
      } catch (e: any) {
        log.warn(
          `[DOWNLOAD:DIR] Could not publish queued event: ${e?.message ?? e}`,
        );
      }

      log.info('[DOWNLOAD:DIR] Starting compression worker');

      await new Promise((res, rej) => {
        pm2.start(
          {
            name: `compress-${user.id}-${job.id}`,
            script: Path.resolve(
              __dirname,
              '../../../sse_server/compression-worker.js',
            ),
            autorestart: false,
            force: true,
            namespace: process.env.COMPRESSION_QUEUE_NAME as string,
          },
          (err, proc) => {
            if (err) {
              log.error(
                `[DOWNLOAD:DIR] Error while starting pm2: ${err.message}`,
              );
              return rej(err);
            }

            return res(proc);
          },
        );
      });

      return {
        mode: 'queued_user_job' as const,
        jobId: job.id,
        downloadUrl: undefined,
        cacheTier: undefined,
        reused: false,
      };
    } catch (e: any) {
      log.error(`[DOWNLOAD:DIR] Error while adding job: ${e.message}`);
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message:
          'Ocurrió un error al intentar iniciar la compresión de la carpeta',
      });
    }
  });
