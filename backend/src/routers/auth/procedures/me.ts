import { compareAsc } from 'date-fns';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';

/**
 * Returns the current logged in user
 * */
export const me = shieldedProcedure.query(
  async ({ ctx: { session, prisma } }) => {
    const user = session!.user!;

    const ftpAccount = await prisma.ftpUser.findFirst({
      where: {
        user_id: user.id,
      },
      orderBy: {
        accessed: 'desc',
      },
    });

    const hasActiveSubscription = await prisma.descargasUser.findFirst({
      where: {
        AND: [
          {
            user_id: user.id,
          },
          {
            date_end: {
              gt: new Date().toISOString(),
            },
          },
        ],
      },
    });

    return {
      ...session?.user,
      hasActiveSubscription: Boolean(hasActiveSubscription),
      ftpAccount: ftpAccount
        ? {
            ...ftpAccount,
            host: process.env.FTP_HOST,
            port: process.env.FTP_PORT,
          }
        : null,
    };
  },
);
