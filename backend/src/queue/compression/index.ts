import { Queue } from 'bullmq';
import { log } from '../../server';

export const compressionQueueName = 'dir-compression';

export let compressionQueue: Queue;

export const initializeCompressionQueue = () => {
  compressionQueue = new Queue(compressionQueueName, {
    connection: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT as string, 10),
      enableOfflineQueue: false,
    },
  });

  compressionQueue.on('error', (error) => {
    log.error(`[QUEUE:COMPRESSION] Error: ${error.message}`);
  });

  compressionQueue.on('waiting', (job) => {
    // Create a new worker if there are no workers available
    // workerFactory();

    log.info(`[QUEUE:COMPRESSION] Waiting for job: ${job.id}`);
  });
};
