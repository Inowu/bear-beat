import { z } from 'zod';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { redis, redisFileIndexName } from '../../redis';

export const search = shieldedProcedure
  .input(
    z.object({
      query: z.string(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
  )
  .query(async ({ input: { query, limit, offset } }) =>
    redis.ft.search(redisFileIndexName, `*${query}*`, {
      LIMIT: {
        from: offset ?? 0,
        size: limit ?? 10,
      },
    }),
  );
