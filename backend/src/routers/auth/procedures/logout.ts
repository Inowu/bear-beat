import { shieldedProcedure } from '../../../procedures/shielded.procedure';

export const logout = shieldedProcedure.mutation(
  async ({ ctx: { prisma, session } }) => {
    await prisma.users.update({
      where: {
        id: session?.user?.id,
      },
      data: {
        refresh_token: null,
      },
    });

    return true;
  },
);
