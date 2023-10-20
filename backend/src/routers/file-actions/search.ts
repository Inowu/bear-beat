import { z } from 'zod';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { redis, redisFileIndexName } from '../../redis';
import Fuse from 'fuse.js';

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

    const searchTerm = [
      `*${escapedQuery}*`,
      escapedQuery,
      ...escapedQuery.split(' '),
    ].join('|');

    const results = await redis.ft.search(redisFileIndexName, searchTerm, {
      LIMIT: {
        from: offset ?? 0,
        size: limit ?? 10,
      },
    });

    const fuse = new Fuse(results.documents, {
      includeScore: true,
      keys: ['value.name'],
    });

    return {
      ...results,
      documents: fuse.search(query).map((result) => result.item),
    };
  });
