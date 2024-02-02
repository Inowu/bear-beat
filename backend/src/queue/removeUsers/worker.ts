import { Worker, Job } from 'bullmq';
import { removeUsersQueueName } from '.';
import { log } from '../../server';
import { sse } from '../../sse';
import removeUsersProcessor from './removeUsersWorker';
import type { RemoveUsersJob } from './types';
import { prisma } from '../../db';
import { JobStatus } from '../jobStatus';

export const createRemoveUsersWorker = () => {
  const removeUsersWorker = new Worker<RemoveUsersJob>(
    removeUsersQueueName,
    removeUsersProcessor,
    {
      // lockDuration: 1000 * 60 * 60 * 10,
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

  removeUsersWorker.on('paused', () => {
    log.info('[WORKER:REMOVE_USER] Worker paused');
  });

  removeUsersWorker.on('completed', async (job: Job<RemoveUsersJob>) => {
    log.info(`[WORKER:REMOVE_USER:COMPLETED] Job ${job.id} completed`);

    const prismaJob = await prisma.jobs.findFirst({
      where: {
        AND: [
          {
            jobId: job?.id,
          },
          {
            queue: removeUsersQueueName,
          },
        ],
      },
    });

    if (!prismaJob) {
      log.warn(
        `[WORKER:REMOVE_USER:COMPLETED] Job was not found in db, job id ${job?.id}`,
      );
    }

    if (prismaJob) {
      await prisma.jobs.update({
        where: {
          id: prismaJob.id,
        },
        data: {
          status: JobStatus.COMPLETED,
          finishedAt: new Date(),
        },
      });
    }

    sse.send(
      JSON.stringify({
        queue: removeUsersQueueName,
        jobId: job.id,
      }),
      'remove-users:completed',
    );
  });

  removeUsersWorker.on('failed', async (job, error) => {
    log.error(
      `[WORKER:REMOVE_USER:FAILED] Job ${job?.id}, error: ${error.message}`,
    );
    const prismaJob = await prisma.jobs.findFirst({
      where: {
        AND: [
          {
            jobId: job?.id,
          },
          {
            queue: removeUsersQueueName,
          },
        ],
      },
    });

    if (!prismaJob) {
      log.warn(
        `[WORKER:REMOVE_USER:FAILED] Job was not found in db, job id ${job?.id}`,
      );
    }

    if (prismaJob) {
      await prisma.jobs.update({
        where: {
          id: prismaJob.id,
        },
        data: {
          status: JobStatus.FAILED,
          finishedAt: new Date(),
        },
      });
    }

    sse.send(
      JSON.stringify({
        jobId: job?.id,
        queue: removeUsersQueueName,
      }),
      'remove-users:failed',
    );
  });

  removeUsersWorker.on('stalled', (job) => {
    log.warn(`[WORKER:REMOVE_USER] Job ${job} stalled`);
  });

  removeUsersWorker.on('error', (error) => {
    log.error(`[WORKER:REMOVE_USER] Error: ${error}`);
  });

  removeUsersWorker.on('progress', (job) => {
    const progress = Math.round(job.progress as number);

    if (progress % 5 !== 0 || progress === 0) return;

    sse.send(
      JSON.stringify({
        progress,
        queue: removeUsersQueueName,
        jobId: job.id,
      }),
      'remove-users:progress',
    );
  });

  return removeUsersWorker;
};
