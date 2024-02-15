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
      const newWorker = createCompressionWorker();
      compressionWorkers.push(createCompressionWorker());

      return newWorker;
    }
  }

  if (queue === 'users') {
    if (removeUsersWorkers.length < 1) {
      log.info('[WORKER:REMOVE_USERS] Creating new worker');
      const newWorker = createRemoveUsersWorker();
      removeUsersWorkers.push(newWorker);

      return newWorker;
    }
  }
};
