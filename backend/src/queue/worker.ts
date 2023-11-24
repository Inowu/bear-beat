import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { Job, Worker } from 'bullmq';
// import jobHandler from './compression-worker';
import fastFolderSize from 'fast-folder-size/sync';
import { queueName } from '.';
import { log } from '../server';
import { sse } from '../sse';
import { CompressionJob } from './compression-job';

export let compressionWorker: Worker;

export const initializeWorker = () => {
  compressionWorker = new Worker<CompressionJob>(
    queueName,
    `${__dirname}/compression-worker.js`,
    {
      useWorkerThreads: true,
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT as string, 10),
      },
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
        status: 'completed',
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
        status: 'failed',
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

    if (progress % 5 !== 0) return;

    sse.send(
      JSON.stringify({
        progress,
        jobId: job.id,
        status: 'pending',
      }),
      'compression:progress',
    );
  });
};
