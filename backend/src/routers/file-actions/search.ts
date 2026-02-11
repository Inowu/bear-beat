import { z } from 'zod';
import { enrichSearchDocumentsWithTrackMetadata } from '../../metadata';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { log } from '../../server';
import { fileIndexName, meiliSearch } from '../../search';

export const search = shieldedProcedure
  .input(
    z.object({
      query: z.string(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }),
  )
  .query(async ({ input: { query, limit, offset } }) => {
    const results = await meiliSearch.index(fileIndexName).search(query, {
      limit: limit ?? 10,
      offset: offset ?? 0,
    });
    let documents = results.hits as Array<Record<string, any>>;
    try {
      documents = await enrichSearchDocumentsWithTrackMetadata(documents);
    } catch (error: any) {
      log.warn(
        `[TRACK_METADATA] search enrichment failed: ${error?.message ?? 'unknown error'}`,
      );
    }

    return {
      total: results.estimatedTotalHits,
      documents,
    };
  });
