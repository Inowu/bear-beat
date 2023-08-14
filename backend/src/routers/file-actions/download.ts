import { z } from 'zod';
import { publicProcedure } from '../../procedures/public.procedure';
import { sftp } from '../../ftp';

export default publicProcedure
  .input(
    z.object({
      path: z.string(),
    }),
  )
  .query(async ({ input: { path }, ctx: { res } }) => {
    const buffer = await sftp.get(`${process.env.SONGS_PATH}/${path}`);

    res.send(buffer);
  });
