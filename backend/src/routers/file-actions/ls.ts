import { z } from 'zod';
import { fileService } from '../../ftp';
import {
  enrichFilesWithTrackMetadata,
  resolveChildCatalogPath,
  syncTrackMetadataForFiles,
} from '../../metadata';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { log } from '../../server';

export const ls = shieldedProcedure
  .input(
    z.object({
      path: z.string(),
    }),
  )
  .query(async ({ input: { path } }) => {
    const sanitizedPath = path.replace('..', '').replace('//', '/');
    const files = await fileService.list(`${process.env.SONGS_PATH}${sanitizedPath}`);
    const filesWithPath = files.map((file) => ({
      ...file,
      path: resolveChildCatalogPath(sanitizedPath, file.name),
    }));

    try {
      await syncTrackMetadataForFiles(filesWithPath);
      return enrichFilesWithTrackMetadata(filesWithPath);
    } catch (error: any) {
      log.warn(
        `[TRACK_METADATA] ls enrichment failed: ${error?.message ?? 'unknown error'}`,
      );
      return filesWithPath;
    }
  });
