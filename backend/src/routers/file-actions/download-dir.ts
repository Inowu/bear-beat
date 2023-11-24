import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { fileService } from '../../ftp';
import { log } from '../../server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { compressionQueue } from '../../queue';
import { CompressionJob } from '../../queue/compression-job';

export const downloadDir = shieldedProcedure
  .input(
    z.object({
      path: z.string(),
    }),
  )
  .query(async ({ input: { path }, ctx: { prisma, session } }) => {
    const user = session!.user!;

    const fullPath = `${process.env.SONGS_PATH}${path}`;
    const fileExists = await fileService.exists(fullPath);

    if (!fileExists) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Ese directorio existe',
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

    if (activePlans.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Este usuario no tiene un plan activo',
      });
    }

    const ftpUser = await prisma.ftpUser.findFirst({
      where: {
        user_id: user?.id,
      },
    });

    if (!ftpUser) {
      log.error(
        `[DOWNLOAD:DIR] This user does not have an ftp user (${user.id})`,
      );

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Este usuario no tiene una cuenta FTP',
      });
    }

    const quotaLimit = await prisma.ftpQuotaLimits.findFirst({
      where: {
        name: ftpUser.userid,
      },
    });

    const quotaUsed = await prisma.ftpquotatallies.findFirst({
      where: {
        name: ftpUser.userid,
      },
    });

    if (!quotaLimit || !quotaUsed) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This user is not allowed to download this content',
      });
    }

    const fileStat = await fileService.stat(fullPath);

    const availableBytes =
      quotaLimit.bytes_out_avail - quotaUsed.bytes_out_used;

    if (availableBytes < fileStat.size) {
      log.error('[DOWNLOAD:DIR] Not enough bytes left');

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'The user does not have enough available bytes left',
      });
    }

    const job = await compressionQueue.add(`compress-${user.id}`, {
      songsAbsolutePath: fullPath,
      songsRelativePath: path,
      userId: user.id,
    } as CompressionJob);

    log.info(
      `[DOWNLOAD:DIR] Initiating directory compression job ${job.id}, user: ${user.id}`,
    );

    return {
      jobId: job.id,
    };
  });
