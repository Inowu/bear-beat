import { z } from 'zod';
import pm2 from 'pm2';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { TRPCError } from '@trpc/server';
import { JobStatus } from '../../queue/jobStatus';
import { log } from '../../server';

export const cancelDirDownload = shieldedProcedure
  .input(
    z.object({
      jobId: z.string(),
    }),
  )
  .mutation(async ({ input: { jobId }, ctx: { session, prisma } }) => {
    const user = session!.user!;

    const job = await prisma.jobs.findFirst({
      where: {
        jobId,
      },
    });

    if (!job) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Ese trabajo no existe',
      });
    }

    try {
      await new Promise((res, rej) => {
        pm2.delete(`compress-${user.id}-${jobId}`, (err, proc) => {
          if (err) {
            log.error(
              `[DOWNLOAD:DIR:CANCEL] Error while cancelling download: ${err.message}`,
            );
            return rej('Ocurrió un error al cancelar la descarga');
          }

          return res(proc);
        });
      });
    } catch (e: any) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: e.message,
      });
    }

    const download = await prisma.dir_downloads.findFirst({
      where: {
        jobId: job.id,
      },
    });

    if (!download) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Esa descarga no existe',
      });
    }

    log.info(`[DOWNLOAD:DIR:CANCEL] Download cancelled: ${jobId}`);
    await prisma.$transaction([
      prisma.jobs.update({
        where: {
          id: job.id,
        },
        data: {
          status: JobStatus.CANCELLED,
          finishedAt: new Date(),
        },
      }),
      // Update the expiration date to the current date, the zip file will later be removed by a script
      prisma.dir_downloads.update({
        where: {
          id: download.id,
        },
        data: {
          expirationDate: new Date(),
        },
      }),
    ]);

    return {
      message: 'La descarga ha sido cancelada correctamente',
    };
  });
