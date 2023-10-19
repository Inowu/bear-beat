import { createClient } from 'redis';
import { log } from '../server';

// eslint-disable-next-line import/no-mutable-exports
export let redis: ReturnType<typeof createClient>;

export const initializeRedis = async () => {
  log.info('[REDIS] Initializing redis...');

  redis = await createClient()
    .on('error', (e) => {
      log.error(`[REDIS] Error connecting to redis. ${e}`);
    })
    .connect();
};

export const redisFileIndexKey = 'file-index';

export const redisFileIndexName = 'file-index-idx';
