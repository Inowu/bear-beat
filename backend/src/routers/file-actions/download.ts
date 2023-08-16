import fs from 'fs';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { log } from '../../server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';

export const download = shieldedProcedure
  .input(
    z.object({
      path: z.string(),
    }),
  )
  .query(async ({ input: { path }, ctx: { prisma, session } }) => {
    const { user } = session!;

    const fullPath = `${process.env.SONGS_PATH}${path}`;
    const fileExists = fs.existsSync(fullPath);

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
        message: 'This user does not have an active plan',
      });
    }

    const quotaLimit = await prisma.ftpQuotaLimits.findFirst({
      where: {
        name: user?.username,
      },
    });

    const quotaUsed = await prisma.ftpquotatallies.findFirst({
      where: {
        name: user?.username,
      },
    });

    if (!quotaLimit || !quotaUsed) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This user is not allowed to download this content',
      });
    }

    const fileStat = fs.statSync(fullPath);

    const availableBytes =
      quotaLimit.bytes_out_avail - quotaUsed.bytes_out_used;

    if (availableBytes < fileStat.size) {
      log.error('[File Download] Not enough bytes left');

      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'The user does not have enough available bytes left',
      });
    }

    const stream = fs.readFileSync(fullPath);

    log.info(
      `[File Download] id: ${user?.id}, username: ${user?.username}, bytes: ${availableBytes}`,
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

    return {
      file: stream.toString('base64'),
      size: fileStat.size,
    };
  });
