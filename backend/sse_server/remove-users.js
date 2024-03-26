import { Job, Worker } from 'bullmq';
import { CustomersApi, Configuration } from 'conekta';
import { log } from './log';
import { prisma } from './db';
import { JobStatus } from './job-status';
import Stripe from 'stripe';

let stripe;

if (process.env.NODE_ENV === 'production') {
  stripe = new Stripe(process.env.STRIPE_KEY, {
    apiVersion: '2023-08-16',
  });
} else {
  stripe = new Stripe(process.env.STRIPE_TEST_KEY, {
    apiVersion: '2023-08-16',
  });
}

const apiKey =
  process.env.NODE_ENV === 'production'
    ? process.env.CONEKTA_KEY
    : process.env.CONEKTA_TEST_KEY;

const conektaConfig = new Configuration({ apiKey, accessToken: apiKey });

const conektaCustomers = new CustomersApi(conektaConfig);

const stripeInstance = stripe;

export const createRemoveUsersWorker = () => {
  const removeUsersWorker = new Worker(
    process.env.REMOVE_USERS_QUEUE_NAME,
    async function (job) {
      for (let i = 0; i < job.data.userCustomerIds.length; i++) {
        const ids = job.data.userCustomerIds[i];

        // DO NOT DELETE USERS IN TEST SERVER, SINCE DATABASE IS A COPY OF PRODUCTION
        // log.info(
        //   `[REMOVE_INACTIVE_USERS] Test server, simulating delay. Stripe id: ${ids.stripe}, Conekta id: ${ids.conekta}`,
        // );
        // await new Promise((res) => setTimeout(res, 100));
        // job.updateProgress((i / job.data.userCustomerIds.length) * 100);
        // continue;

        try {
          log.info(
            `[REMOVE_INACTIVE_USERS] Removing stripe customer for user ${ids.stripe}...`,
          );

          if (ids.stripe) {
            await stripeInstance.customers.del(ids.stripe);
          }

          log.info(
            `[REMOVE_INACTIVE_USERS] Removed stripe customer for user ${ids.stripe}`,
          );
        } catch (e) {
          log.error(
            `[REMOVE_INACTIVE_USERS] Error removing stripe customer for user ${ids.stripe}, ${e}`,
          );
        }

        try {
          log.info(
            `[REMOVE_INACTIVE_USERS] Removing conekta customer for user ${ids.conekta}...`,
          );

          if (ids.conekta) {
            await conektaCustomers.deleteCustomerById(ids.conekta);
          }

          log.info(
            `[REMOVE_INACTIVE_USERS] Removed conekta customer for user ${ids.conekta}`,
          );
        } catch (e) {
          log.error(
            `[REMOVE_INACTIVE_USERS] Error removing conekta customer for user ${ids.conekta}, ${e}`,
          );
        }

        // Avoid rate limiting
        await new Promise((res) => setTimeout(res, 500));

        job.updateProgress((i / job.data.userCustomerIds.length) * 100);
      }
    },
    {
      lockDuration: 1000 * 60 * 60 * 10, // 10 hours
      removeOnComplete: {
        count: 0,
      },
      removeOnFail: {
        count: 0,
      },
      connection: {
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT, 10),
      },
      concurrency: 1,
    },
  );

  removeUsersWorker.on('paused', () => {
    log.info('[WORKER:REMOVE_USER] Worker paused');
  });

  removeUsersWorker.on('completed', async (job) => {
    log.info(`[WORKER:REMOVE_USER:COMPLETED] Job ${job.id} completed`);

    const prismaJob = await prisma.jobs.findFirst({
      where: {
        AND: [
          {
            jobId: job?.id,
          },
          {
            queue: process.env.REMOVE_USERS_QUEUE_NAME,
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

    await sendEvent(`remove-users:completed:${job.data.userId}`, {
      queue: process.env.REMOVE_USERS_QUEUE_NAME,
      jobId: job.id,
    });
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
            queue: process.env.REMOVE_USERS_QUEUE_NAME,
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

    await sendEvent(`remove-users:failed:${job?.data.userId}`, {
      jobId: job?.id,
      queue: process.env.REMOVE_USERS_QUEUE_NAME,
    });
  });

  removeUsersWorker.on('stalled', (job) => {
    log.warn(`[WORKER:REMOVE_USER] Job ${job} stalled`);
  });

  removeUsersWorker.on('error', (error) => {
    log.error(`[WORKER:REMOVE_USER] Error: ${error}`);
  });

  removeUsersWorker.on('progress', async (job) => {
    const progress = Math.round(job.progress);

    if (progress % 5 !== 0 || progress === 0) return;

    await sendEvent(`remove-users:progress:${job.data.userId}`, {
      progress,
      queue: process.env.REMOVE_USERS_QUEUE_NAME,
      jobId: job.id,
    });
  });

  return removeUsersWorker;
};
