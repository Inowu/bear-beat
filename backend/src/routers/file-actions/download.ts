import fs from 'fs';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { publicProcedure } from '../../procedures/public.procedure';
// import { sftp } from '../../ftp';

export default publicProcedure
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

    const quotaLimit = await prisma.ftpQuotaLimits.findFirst({
      where: {
        name: user?.username,
      },
    });

    if (!quotaLimit) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This user is not allowed to download this content',
      });
    }

    const fileStat = fs.statSync(fullPath);

    if (quotaLimit.bytes_out_avail < fileStat.size) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: "The user has exceeded it's quota",
      });
    }

    const stream = fs.readFileSync(fullPath);

    return {
      file: stream.toString('base64'),
    };
  });
