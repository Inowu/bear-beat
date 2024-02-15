import { z } from 'zod';
import Path from 'path';
import { TRPCError } from '@trpc/server';
import { fileService } from '../../ftp';
import { log } from '../../server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { compressionQueue } from '../../queue/compression';
import type { CompressionJob } from '../../queue/compression/types';
import { extendedAccountPostfix } from '../../utils/constants';
import { logPrefix } from '../../endpoints/download.endpoint';
import fastFolderSizeSync from 'fast-folder-size/sync';
import { JobStatus } from '../../queue/jobStatus';
import { workerFactory } from '../../queue/workerFactory';

const MAX_CONCURRENT_DOWNLOADS = 10;

export const downloadDir = shieldedProcedure
  .input(
    z.object({
      path: z.string(),
    }),
  )
  .query(async ({ input: { path }, ctx: { prisma, session } }) => {
    const user = session!.user!;

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

    if (inProgressJobs.length > MAX_CONCURRENT_DOWNLOADS) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Hay demasiadas descargas en progreso, intentalo más tarde',
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

    const activePlans = await prisma.descargasUser.findMany({
      where: {
        AND: [
          {
            date_end: {
              gte: new Date().toISOString(),
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
      log.error(`[DOWNLOAD] This user does not have an ftp user (${user.id})`);

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
        `${logPrefix(useExtendedAccount)} This user does not have quotas (${
          user.id
        })`,
      );

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No hay quotas activas para este usuario',
      });
    }

    const hasRemainingGb =
      quotaTallies.bytes_out_used < quotaLimits.bytes_out_avail;

    if ((activePlans.length === 0 || !hasRemainingGb) && extendedAccount) {
      log.info(`[DOWNLOAD] Using extended account for user ${user.id}`);
      regularFtpUser = extendedAccount;
      useExtendedAccount = true;
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
        `${logPrefix(useExtendedAccount)} This user does not have quotas (${
          user.id
        })`,
      );
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'No hay quotas activas para este usuario',
      });
    }

    const fileStat = await fileService.stat(fullPath);

    const availableBytes =
      quotaLimits.bytes_out_avail - quotaTallies.bytes_out_used;

    if (availableBytes < fileStat.size) {
      log.error(
        `${logPrefix(useExtendedAccount)} Not enough bytes left, user id: ${
          user.id
        }, song path: ${fullPath}`,
      );

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Este usuario no tiene suficientes bytes disponibles',
      });
    }

    try {
      log.info(`[DOWNLOAD:DIR] User ${user.id} is downloading ${path}`);

      const dirDownload = await prisma.dir_downloads.create({
        data: {
          userId: user.id,
          date: new Date().toISOString(),
          size: fastFolderSizeSync(fullPath),
          dirName: Path.basename(fullPath),
        },
      });

      log.info(`[DOWNLOAD:DIR] Adding job to queue for user ${user.id}`);

      const job = await compressionQueue.add(`compress-${user.id}`, {
        songsAbsolutePath: fullPath,
        songsRelativePath: path,
        userId: user.id,
        dirDownloadId: dirDownload.id,
        ftpAccountName:
          extendedAccount && useExtendedAccount
            ? extendedAccount.userid
            : regularFtpUser.userid,
        ftpTalliesId: quotaTallies.id,
        dirSize: Number(dirDownload.size),
      } as CompressionJob);

      await prisma.dir_downloads.update({
        where: {
          id: dirDownload.id,
        },
        data: {
          jobId: Number(job.id),
        },
      });

      // Pre-update the bytes used and update it back later if the job fails
      // This is necessary so the user cannot use more bytes than they have
      log.info(`[DOWNLOAD:DIR] Pre-updating bytes used for user ${user.id}`);
      await prisma.ftpquotatallies.update({
        where: {
          id: quotaTallies.id,
        },
        data: {
          bytes_out_used: quotaTallies.bytes_out_used + BigInt(fileStat.size),
        },
      });

      log.info(
        `[DOWNLOAD:DIR] Initiating directory compression job ${job.id}, user: ${user.id}`,
      );

      return {
        jobId: job.id,
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
