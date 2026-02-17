import { Queue, Worker } from 'bullmq';
import { log } from '../../server';

export type ManyChatRetryJobData =
  | {
      action: 'add_tag';
      subscriberId: string;
      tag: string;
      userId?: number | null;
    }
  | {
      action: 'set_custom_field';
      subscriberId: string;
      fieldKey: string;
      fieldValue: string;
      userId?: number | null;
    };

type ManyChatRetryProcessor = (jobData: ManyChatRetryJobData) => Promise<void>;

export let manyChatRetryQueue: Queue<ManyChatRetryJobData> | null = null;
let manyChatRetryWorker: Worker<ManyChatRetryJobData> | null = null;
let didInitializeManyChatRetryQueue = false;

const toPositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return Math.floor(parsed);
};

const getRedisConnection = () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: toPositiveInt(process.env.REDIS_PORT, 6379),
  enableOfflineQueue: false,
});

const getQueueName = (): string =>
  (process.env.MANYCHAT_RETRY_QUEUE_NAME || 'bearbeat_manychat_retry').trim();

const getRetryAttempts = (): number =>
  toPositiveInt(process.env.MANYCHAT_RETRY_ATTEMPTS, 6);

const getRetryBackoffMs = (): number =>
  toPositiveInt(process.env.MANYCHAT_RETRY_BACKOFF_MS, 5000);

const getWorkerConcurrency = (): number =>
  toPositiveInt(process.env.MANYCHAT_RETRY_CONCURRENCY, 2);

export const initializeManyChatRetryQueue = (
  processor: ManyChatRetryProcessor,
): void => {
  if (didInitializeManyChatRetryQueue) return;

  const queueName = getQueueName();
  const connection = getRedisConnection();

  try {
    manyChatRetryQueue = new Queue<ManyChatRetryJobData>(queueName, {
      connection,
      defaultJobOptions: {
        attempts: getRetryAttempts(),
        backoff: {
          type: 'exponential',
          delay: getRetryBackoffMs(),
        },
        removeOnComplete: 500,
        removeOnFail: 1000,
      },
    });

    manyChatRetryWorker = new Worker<ManyChatRetryJobData>(
      queueName,
      async (job) => {
        await processor(job.data);
      },
      {
        connection,
        concurrency: getWorkerConcurrency(),
      },
    );

    manyChatRetryQueue.on('error', (error) => {
      log.error(`[QUEUE:MANYCHAT_RETRY] Queue error: ${error.message}`);
    });
    manyChatRetryWorker.on('error', (error) => {
      log.error(`[QUEUE:MANYCHAT_RETRY] Worker error: ${error.message}`);
    });
    manyChatRetryWorker.on('failed', (job, error) => {
      log.warn('[QUEUE:MANYCHAT_RETRY] Job failed', {
        jobId: job?.id ?? null,
        action: job?.data?.action ?? null,
        attemptsMade: job?.attemptsMade ?? null,
        error: error?.message ?? 'unknown_error',
      });
    });

    didInitializeManyChatRetryQueue = true;
  } catch (error: any) {
    manyChatRetryWorker = null;
    manyChatRetryQueue = null;
    didInitializeManyChatRetryQueue = false;
    throw error;
  }
};

export const enqueueManyChatRetryJob = async (
  jobData: ManyChatRetryJobData,
): Promise<string | null> => {
  if (!manyChatRetryQueue) {
    log.warn('[QUEUE:MANYCHAT_RETRY] Queue not initialized; skipping enqueue', {
      action: jobData.action,
      userId: jobData.userId ?? null,
    });
    return null;
  }

  try {
    const job = await manyChatRetryQueue.add(jobData.action, jobData);
    return job.id ? String(job.id) : null;
  } catch (error: any) {
    log.error('[QUEUE:MANYCHAT_RETRY] Failed to enqueue job', {
      action: jobData.action,
      userId: jobData.userId ?? null,
      error: error instanceof Error ? error.message : String(error ?? ''),
    });
    return null;
  }
};

export const closeManyChatRetryQueue = async (): Promise<void> => {
  const tasks: Array<Promise<unknown>> = [];
  if (manyChatRetryWorker) tasks.push(manyChatRetryWorker.close());
  if (manyChatRetryQueue) tasks.push(manyChatRetryQueue.close());
  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }
  manyChatRetryWorker = null;
  manyChatRetryQueue = null;
  didInitializeManyChatRetryQueue = false;
};
