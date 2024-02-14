import type { Worker } from 'bullmq';
import { log } from '../server';
import type { CompressionJob } from './compression/types';
import { createCompressionWorker } from './compression/worker';
import { RemoveUsersJob } from './removeUsers/types';
import { createRemoveUsersWorker } from './removeUsers/worker';

export const compressionWorkers: Array<Worker<CompressionJob>> = [];
export const removeUsersWorkers: Array<Worker<RemoveUsersJob>> = [];

export const workerFactory = (queue: 'compression' | 'users') => {
  if (queue === 'compression') {
    if (compressionWorkers.length < 1) {
      log.info('[WORKER:COMPRESSION] Creating new worker');
      compressionWorkers.push(createCompressionWorker());
    }

    return createCompressionWorker();
  }

  if (queue === 'users') {
    if (removeUsersWorkers.length < 1) {
      log.info('[WORKER:REMOVE_USERS] Creating new worker');
      removeUsersWorkers.push(createRemoveUsersWorker());
    }
    return createRemoveUsersWorker();
  }
};
