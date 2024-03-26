import express from 'express';
import expressWinston from 'express-winston';
import { Job, Worker } from 'bullmq';
import { addDays } from 'date-fns';
import SSE from 'express-sse-ts';
import cors from 'cors';
import path from 'path';
import winston from 'winston';
import { config } from 'dotenv';
import { PrismaClient } from '@prisma/client';

config();

const prisma = new PrismaClient({
  log: ['error'],
});

const compressionQueueName = 'dir-compression';

const log = winston.createLogger();

log.add(
  new winston.transports.Console({
    format: winston.format.json(),
  }),
);

const sse = new SSE();

const app = express();

app.use(
  expressWinston.logger({
    transports: [new winston.transports.Console()],
    format: winston.format.json(),
  }),
);

app.use(cors({ origin: '*' }));

app.get('/sse', sse.init);

app.listen(8001, () => {
  log.info('SSE server listening on port 8001');
});

export const MAX_CONCURRENT_DOWNLOADS = 25;

const compressionWorker = new Worker(
  compressionQueueName,
  // Spawn a new process for each job
  `${__dirname}/compression-worker.js`,
  // compression,
  {
    lockDuration: 1000 * 60 * 60 * 10,
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
    concurrency: MAX_CONCURRENT_DOWNLOADS,
  },
);

compressionWorker.on('paused', () => {
  log.info('[WORKER:COMPRESSION] Worker paused');
});

compressionWorker.on('completed', async (job: Job) => {
  log.info(`[WORKER:COMPRESSION:COMPLETED] Job ${job.id} completed`);
  // Save the download URL in the database in case the user wants to download it later
  const dirName = encodeURIComponent(
    `${path.basename(job.data.songsRelativePath)}-${job.data.userId}-${job.id}`,
  );
  const downloadUrl = `${process.env.BACKEND_URL}/download-dir?dirName=${dirName}.zip&jobId=${job.id}`;

  try {
    const dirDownload = await prisma.dir_downloads.update({
      where: {
        id: job.data.dirDownloadId,
      },
      data: {
        // Note: The client has to append the token to the URL. &token=<token>
        downloadUrl,
        // The URL is valid for 24 hours
        expirationDate: addDays(new Date(), 1),
      },
    });

    const dbJob = await prisma.jobs.findFirst({
      where: {
        id: dirDownload.jobId!,
      },
    });

    if (!dbJob) {
      log.error(
        `[WORKER:COMPRESSION:COMPLETED] Job ${job.id} not found in the database`,
      );
      return;
    }

    await prisma.jobs.update({
      where: {
        id: dbJob.id,
      },
      data: {
        status: 'completed',
        finishedAt: new Date(),
      },
    });
  } catch (e) {
    log.error(
      `[WORKER:COMPRESSION:COMPLETED] Error updating job status: ${
        (e as Error).message
      }`,
    );
  }

  sse.send(
    JSON.stringify({
      jobId: job.id,
      url: downloadUrl,
    }),
    `compression:completed:${job.data.userId}`,
  );
});

compressionWorker.on('failed', async (job, error) => {
  log.error(
    `[WORKER:COMPRESSION:FAILED] Job ${job?.id}, error: ${error.message}`,
  );

  if (job?.id) {
    try {
      const dirDownload = await prisma.dir_downloads.findFirst({
        where: {
          id: job.data.dirDownloadId,
        },
      });

      if (!dirDownload) {
        log.error(
          `[WORKER:COMPRESSION:FAILED] Could not find dir download for job ${job?.id}`,
        );
        return;
      }

      await prisma.jobs.update({
        where: {
          id: dirDownload.jobId!,
        },
        data: {
          status: 'failed',
          finishedAt: new Date(),
        },
      });
    } catch (e: unknown) {
      log.error(
        `[WORKER:COMPRESSION:FAILED] Error updating job status: ${
          (e as Error).message
        }`,
      );
    }

    const currentTallies = await prisma.ftpquotatallies.findFirst({
      where: {
        id: job?.data.ftpTalliesId,
      },
    });

    if (currentTallies) {
      log.info(
        `[WORKER:COMPRESSION:FAILED] Updating tallies back for user ${job.data.userId} after failed job ${job?.id}`,
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
        `[WORKER:COMPRESSION:FAILED] Could not find tallies for job ${job?.id}, job: ${job?.data}`,
      );
    }
  }

  sse.send(
    JSON.stringify({
      jobId: job?.id,
    }),
    `compression:failed:${job?.data.userId}`,
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
    `compression:progress:${job.data.userId}`,
  );
});
