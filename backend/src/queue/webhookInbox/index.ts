import { Queue, Worker } from 'bullmq';
import { log } from '../../server';

export interface WebhookInboxJobData {
  inboxId: number;
}

type WebhookInboxProcessor = (jobData: WebhookInboxJobData) => Promise<void>;
type WebhookInboxSweeper = () => Promise<void>;

export let webhookInboxQueue: Queue<WebhookInboxJobData> | null = null;
let webhookInboxWorker: Worker<WebhookInboxJobData> | null = null;
let sweeperIntervalRef: NodeJS.Timeout | null = null;
let sweeperInFlight = false;
let didInitializeWebhookInboxQueue = false;

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
  (process.env.WEBHOOK_INBOX_QUEUE_NAME || 'bearbeat_webhook_inbox').trim();

const getWorkerConcurrency = (): number =>
  toPositiveInt(process.env.WEBHOOK_INBOX_CONCURRENCY, 4);

const getSweeperIntervalMs = (): number =>
  toPositiveInt(process.env.WEBHOOK_INBOX_SWEEP_INTERVAL_MS, 60_000);

const runSweeperSafely = async (
  sweeper?: WebhookInboxSweeper,
): Promise<void> => {
  if (!sweeper || sweeperInFlight) return;
  sweeperInFlight = true;
  try {
    await sweeper();
  } catch (error) {
    log.error('[QUEUE:WEBHOOK_INBOX] Sweeper execution failed', {
      error: error instanceof Error ? error.message : String(error ?? ''),
    });
  } finally {
    sweeperInFlight = false;
  }
};

export const initializeWebhookInboxQueue = (
  processor: WebhookInboxProcessor,
  sweeper?: WebhookInboxSweeper,
): void => {
  if (didInitializeWebhookInboxQueue) return;

  const queueName = getQueueName();
  const connection = getRedisConnection();

  try {
    webhookInboxQueue = new Queue<WebhookInboxJobData>(queueName, {
      connection,
      defaultJobOptions: {
        attempts: 1,
        removeOnComplete: 1000,
        removeOnFail: 2000,
      },
    });

    webhookInboxWorker = new Worker<WebhookInboxJobData>(
      queueName,
      async (job) => {
        await processor(job.data);
      },
      {
        connection,
        concurrency: getWorkerConcurrency(),
      },
    );

    webhookInboxQueue.on('error', (error) => {
      log.error(`[QUEUE:WEBHOOK_INBOX] Queue error: ${error.message}`);
    });

    webhookInboxWorker.on('error', (error) => {
      log.error(`[QUEUE:WEBHOOK_INBOX] Worker error: ${error.message}`);
    });

    webhookInboxWorker.on('failed', (job, error) => {
      log.warn('[QUEUE:WEBHOOK_INBOX] Job failed', {
        jobId: job?.id ?? null,
        inboxId: job?.data?.inboxId ?? null,
        attemptsMade: job?.attemptsMade ?? null,
        error: error?.message ?? 'unknown_error',
      });
    });

    if (sweeper) {
      const intervalMs = getSweeperIntervalMs();
      sweeperIntervalRef = setInterval(() => {
        void runSweeperSafely(sweeper);
      }, intervalMs);
      if (typeof sweeperIntervalRef.unref === 'function') {
        sweeperIntervalRef.unref();
      }
      void runSweeperSafely(sweeper);
    }

    didInitializeWebhookInboxQueue = true;
  } catch (error) {
    webhookInboxWorker = null;
    webhookInboxQueue = null;
    didInitializeWebhookInboxQueue = false;
    if (sweeperIntervalRef) {
      clearInterval(sweeperIntervalRef);
      sweeperIntervalRef = null;
    }
    throw error;
  }
};

export const enqueueWebhookInboxJob = async (
  jobData: WebhookInboxJobData,
): Promise<boolean> => {
  if (!webhookInboxQueue) {
    log.warn('[QUEUE:WEBHOOK_INBOX] Queue not initialized; skipping enqueue', {
      inboxId: jobData.inboxId,
    });
    return false;
  }

  try {
    await webhookInboxQueue.add('process_webhook_inbox_event', jobData);
    return true;
  } catch (error) {
    log.error('[QUEUE:WEBHOOK_INBOX] Failed to enqueue job', {
      inboxId: jobData.inboxId,
      error: error instanceof Error ? error.message : String(error ?? ''),
    });
    return false;
  }
};

export const closeWebhookInboxQueue = async (): Promise<void> => {
  if (sweeperIntervalRef) {
    clearInterval(sweeperIntervalRef);
    sweeperIntervalRef = null;
  }

  const tasks: Array<Promise<unknown>> = [];
  if (webhookInboxWorker) tasks.push(webhookInboxWorker.close());
  if (webhookInboxQueue) tasks.push(webhookInboxQueue.close());
  if (tasks.length > 0) {
    await Promise.allSettled(tasks);
  }

  webhookInboxWorker = null;
  webhookInboxQueue = null;
  sweeperInFlight = false;
  didInitializeWebhookInboxQueue = false;
};

