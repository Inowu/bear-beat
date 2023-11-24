import { Queue } from 'bullmq';
import { log } from '../server';

export const queueName = 'dir-compression';

export let compressionQueue: Queue;

export const initializeQueue = () => {
  compressionQueue = new Queue(queueName, {
    connection: {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT as string, 10),
    },
  });

  compressionQueue.on('error', (error) => {
    log.error(`[QUEUE:COMPRESSION] Error: ${error.message}`);
  });
};
