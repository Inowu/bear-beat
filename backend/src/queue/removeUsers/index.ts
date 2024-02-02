import { Queue } from 'bullmq';
import { log } from '../../server';

export const removeUsersQueueName = 'remove-users';

export let removeUsersQueue: Queue;

export const initializeRemoveUsersQueue = () => {
  removeUsersQueue = new Queue(removeUsersQueueName, {
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT as string, 10) || 6379,
      enableOfflineQueue: false,
    },
  });

  removeUsersQueue.on('error', (error) => {
    log.error(`[QUEUE:REMOVE_USERS] Error: ${error.message}`);
  });

  removeUsersQueue.on('waiting', (job) => {
    log.info(`[QUEUE:REMOVE_USERS] Waiting for job: ${job.id}`);
  });
};
