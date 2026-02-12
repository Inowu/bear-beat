import { z } from 'zod';
import {
  enrichSearchDocumentsWithTrackMetadata,
  inferTrackMetadataFromName,
} from '../../metadata';
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

    // Fallback: if metadata isn't in the DB (or the enrichment failed), still return
    // inferred metadata based on filename so the frontend can render consistent UI.
    documents = documents.map((doc) => {
      if (!doc || typeof doc !== 'object') return doc;

      const hasValue = doc.value && typeof doc.value === 'object';
      const target = hasValue ? (doc.value as Record<string, any>) : (doc as Record<string, any>);
      const existingMetadata = target.metadata;
      if (existingMetadata) {
        return doc;
      }

      const name = target.name;
      if (typeof name !== 'string' || !name.trim()) {
        return doc;
      }

      const inferred = inferTrackMetadataFromName(name);
      if (!inferred) {
        return doc;
      }

      if (hasValue) {
        return {
          ...doc,
          value: {
            ...(doc.value as Record<string, unknown>),
            metadata: inferred,
          },
        };
      }

      return {
        ...doc,
        metadata: inferred,
      };
    });

    return {
      total: results.estimatedTotalHits,
      documents,
    };
  });
