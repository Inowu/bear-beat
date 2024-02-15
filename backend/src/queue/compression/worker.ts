import { Job, Worker } from 'bullmq';
import { compressionQueueName } from '.';
import { log } from '../../server';
import { sse } from '../../sse';
import { CompressionJob } from './types';
import { prisma } from '../../db';
import { addDays } from 'date-fns';

export const createCompressionWorker = () => {
  log.info(`[WORKER:COMPRESSION] Creating worker`);

  const compressionWorker = new Worker<CompressionJob>(
    compressionQueueName,
    // Spawn a new process for each job
    `${__dirname}/compression-worker.js`,
    {
      // lockDuration: 1000 * 60 * 60 * 10,
      useWorkerThreads: true,
      removeOnComplete: {
        count: 0,
      },
      removeOnFail: {
        count: 0,
      },
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT as string, 10),
      },
      concurrency: 1,
    },
  );

  compressionWorker.on('paused', () => {
    log.info('[WORKER:COMPRESSION] Worker paused');
  });

  compressionWorker.on('completed', async (job: Job<CompressionJob>) => {
    log.info(`[WORKER:COMPRESSION] Job ${job.id} completed`);
    // Save the download URL in the database in case the user wants to download it later
    await prisma.dir_downloads.update({
      where: {
        id: job.data.dirDownloadId,
      },
      data: {
        // Note: The client has to append the token to the URL. &token=<token>
        downloadUrl: `${process.env.BACKEND_URL}/download-dir?dirName=${job.data.songsRelativePath}-${job.data.userId}-${job.id}.zip&jobId=${job.id}`,
        // The URL is valid for 24 hours
        expirationDate: addDays(new Date(), 1),
      },
    });

    await prisma.jobs.update({
      where: {
        id: Number(job.id),
      },
      data: {
        status: 'completed',
        finishedAt: new Date(),
      },
    });

    sse.send(
      JSON.stringify({
        jobId: job.id,
        url: `${process.env.BACKEND_URL}/compressed-dirs${job.data.songsRelativePath}-${job.data.userId}-${job.id}.zip`,
      }),
      'compression:completed',
    );
  });

  compressionWorker.on('failed', async (job, error) => {
    log.error(`[WORKER:COMPRESSION] Job ${job?.id}, error: ${error.message}`);

    if (job?.id) {
      await prisma.jobs.update({
        where: {
          id: Number(job?.id),
        },
        data: {
          status: 'failed',
          finishedAt: new Date(),
        },
      });

      const currentTallies = await prisma.ftpquotatallies.findFirst({
        where: {
          id: job?.data.ftpTalliesId,
        },
      });

      if (currentTallies) {
        log.info(
          `[WORKER:COMPRESSION] Updating tallies back for user ${job.data.userId} after failed job ${job?.id}`,
        );

        await prisma.ftpquotatallies.update({
          where: {
            id: job?.data.ftpTalliesId,
          },
          data: {
            bytes_out_used:
              currentTallies.bytes_out_used - BigInt(job?.data.dirSize) < 0
                ? 0
                : currentTallies.bytes_out_used - BigInt(job?.data.dirSize),
          },
        });
      } else {
        log.warn(
          `[WORKER:COMPRESSION] Could not find tallies for job ${job?.id}, job: ${job?.data}`,
        );
      }
    }

    sse.send(
      JSON.stringify({
        jobId: job?.id,
      }),
      'compression:failed',
    );
  });

  compressionWorker.on('stalled', (job) => {
    log.warn(`[WORKER:COMPRESSION] Job ${job} stalled`);
  });

  compressionWorker.on('error', (error) => {
    log.error(`[WORKER:COMPRESSION] Error: ${error}`);
  });

  compressionWorker.on('progress', (job) => {
    const progress = Math.round(job.progress as number);

    if (progress % 5 !== 0 || progress === 0) return;

    sse.send(
      JSON.stringify({
        progress,
        jobId: job.id,
      }),
      'compression:progress',
    );
  });

  return compressionWorker;
};
