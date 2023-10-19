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
  .query(async ({ input: { query, limit, offset } }) => {
    const escapedQuery = query.replace(
      /([^a-zA-Z0-9\s])/g,
      (match) => `\\${match}`,
    );

    const searchTerm = escapedQuery
      .split(' ')
      .map((word) => `%${word}%`)
      .join(' ');

    const results = await redis.ft.search(redisFileIndexName, searchTerm, {
      LIMIT: {
        from: offset ?? 0,
        size: limit ?? 10,
      },
    });

    return {
      ...results,
      documents: results.documents.map((doc) => doc.value),
    };
  });
