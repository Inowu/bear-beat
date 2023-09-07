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

    return {
      ...session?.user,
      hasActiveSubscription: ftpAccount
        ? compareAsc(new Date(ftpAccount!.expiration!), new Date()) >= 0
        : null,
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
