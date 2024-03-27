import { shieldedProcedure } from '../procedures/shielded.procedure';
import { router } from '../trpc';

export const dirDownloadRouter = router({
  myDirDownloads: shieldedProcedure.query(
    async ({ ctx: { prisma, session } }) => {
      const user = session!.user!;

      const dirDownloads = await prisma.dir_downloads.findMany({
        where: {
          userId: user.id,
        },
      });

      return dirDownloads;
    },
  ),
});
