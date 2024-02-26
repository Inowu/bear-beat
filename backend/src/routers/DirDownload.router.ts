import { shieldedProcedure } from '../procedures/shielded.procedure';
import { router } from '../trpc';

export const dirDownloadRouter = router({
  myDirDownloads: shieldedProcedure.query(
    async ({ ctx: { prisma, session } }) => {
      const user = session!.user!;

      const dirDownloads = await prisma.descargasUser.findMany({
        where: {
          user_id: user.id,
        },
      });

      return dirDownloads;
    },
  ),
});
