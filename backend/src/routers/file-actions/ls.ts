import { z } from 'zod';
import { fileService } from '../../ftp';
import { shieldedProcedure } from '../../procedures/shielded.procedure';

export const ls = shieldedProcedure
  .input(
    z.object({
      path: z.string(),
    }),
  )
  .query(async ({ input: { path } }) => {
    const sanitizedPath = path.replace('..', '');

    return fileService.list(`${process.env.SONGS_PATH}${sanitizedPath}`);
  });
