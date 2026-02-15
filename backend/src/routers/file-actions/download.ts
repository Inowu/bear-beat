import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { fileService } from '../../ftp';
import { log } from '../../server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import {
  inferDownloadHistoryRollupCategories,
  normalizeDownloadHistoryFileName,
  toUtcDay,
} from '../../utils/downloadHistoryRollup';

export const download = shieldedProcedure
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
        message: 'That file does not exist',
      });
    }

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

    if (activePlans.length === 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This user does not have an active plan',
      });
    }

    const ftpUser = await prisma.ftpUser.findFirst({
      where: {
        user_id: user?.id,
      },
    });

    if (!ftpUser) {
      log.error(
        `[File Download] This user does not have an ftp user`,
      );

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This user does not have an ftp user',
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
      log.error('[File Download] Not enough bytes left');

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'The user does not have enough available bytes left',
      });
    }

    const downloadedAt = new Date();
    try {
      await prisma.downloadHistory.create({
        data: {
          userId: user.id,
          size: fileStat.size,
          date: downloadedAt,
          fileName: path,
          isFolder: false,
        },
      });
    } catch (e: any) {
      log.warn(
        `[File Download] Failed to write download_history: ${e?.message ?? e}`,
      );
    }

    const normalizedFileName = normalizeDownloadHistoryFileName(path);
    const categories = normalizedFileName
      ? inferDownloadHistoryRollupCategories(normalizedFileName)
      : [];
    if (normalizedFileName && categories.length > 0) {
      const day = toUtcDay(downloadedAt);
      for (const category of categories) {
        try {
          await prisma.downloadHistoryRollupDaily.upsert({
            where: {
              category_day_fileName: {
                category,
                day,
                fileName: normalizedFileName,
              },
            },
            create: {
              category,
              day,
              fileName: normalizedFileName,
              downloads: BigInt(1),
              totalBytes: BigInt(fileStat.size),
              lastDownload: downloadedAt,
            },
            update: {
              downloads: {
                increment: BigInt(1),
              },
              totalBytes: {
                increment: BigInt(fileStat.size),
              },
              lastDownload: downloadedAt,
            },
          });
        } catch (e: any) {
          log.warn(
            `[File Download] Failed to write download_history_rollup_daily: ${e?.message ?? e}`,
          );
        }
      }
    }

    const stream = await fileService.get(fullPath);

    log.info(
      `[File Download] bytes: ${availableBytes}`,
    );

    await prisma.$transaction([
      prisma.ftpQuotaLimits.update({
        where: {
          id: quotaLimit.id,
        },
        data: {
          bytes_out_avail: quotaLimit.bytes_out_avail - BigInt(fileStat.size),
        },
      }),
      prisma.ftpquotatallies.update({
        where: {
          id: quotaUsed.id,
        },
        data: {
          bytes_out_used: quotaUsed.bytes_out_used + BigInt(fileStat.size),
        },
      }),
    ]);

    const payload = {
      file: stream.toString('base64'),
      size: fileStat.size,
    };

    return payload;
  });
