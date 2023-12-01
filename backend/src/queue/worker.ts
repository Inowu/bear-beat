import { Job, Worker } from 'bullmq';
import { queueName } from '.';
import { log } from '../server';
import { sse } from '../sse';
import { CompressionJob } from './compression-job';

export const compressionWorkers: Array<Worker<CompressionJob>> = [];

export const workerFactory = () => {
  if (compressionWorkers.length < 1) {
    log.info('[WORKER:COMPRESSION] Creating new worker');
    compressionWorkers.push(createWorker());
  }

  return createWorker();
};

const createWorker = () => {
  const compressionWorker = new Worker<CompressionJob>(
    queueName,
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

  compressionWorker.on('completed', (job: Job<CompressionJob>) => {
    log.info(`[WORKER:COMPRESSION] Job ${job.id} completed`);
    sse.send(
      JSON.stringify({
        jobId: job.id,
        url: `${process.env.BACKEND_URL}/compressed-dirs${job.data.songsRelativePath}-${job.data.userId}-${job.id}.zip`,
      }),
      'compression:completed',
    );
  });

  compressionWorker.on('failed', (job, error) => {
    log.error(`[WORKER:COMPRESSION] Job ${job?.id}, error: ${error.message}`);
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
