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
    });

    return {
      ...session?.user,
      ftpAccount,
    };
  },
);
