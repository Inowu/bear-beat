import { z } from 'zod';
import { publicProcedure } from '../../procedures/public.procedure';
import { sftp } from '../../ftp';

export default publicProcedure
  .input(
    z.object({
      path: z.string(),
    }),
  )
  .query(async ({ input: { path } }) =>
    (await sftp.list(`${process.env.SONGS_PATH}/${path}`)).map((result) => ({
      name: result.name,
      type: result.type,
    })),
  );
