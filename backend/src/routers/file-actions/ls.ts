import { z } from 'zod';
import { sftp } from '../../ftp';
import { shieldedProcedure } from '../../procedures/shielded.procedure';

export const ls = shieldedProcedure
  .input(
    z.object({
      path: z.string(),
    }),
  )
  .query(async ({ input: { path } }) => {
    const sanitizedPath = path.replace('..', '');

    return (
      await sftp.list(
        `${process.env.SONGS_PATH}/${sanitizedPath}`,
        (file) => !file.name.startsWith('.'),
      )
    ).map((result) => ({
      name: result.name,
      type: result.type,
      modified: result.modifyTime,
    }));
  });
