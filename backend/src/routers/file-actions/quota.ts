import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';

/**
 * Returns the number of bytes used by the user and the number of
 * available bytes
 * */
export const quota = shieldedProcedure.query(
  async ({ ctx: { prisma, session } }) => {
    const user = session!.user!;

    const ftpUser = await prisma.ftpUser.findFirst({
      where: {
        user_id: user.id,
      },
    });

    if (!ftpUser) {
      return {
        used: 0,
        available: 0,
      };
    }

    const quotaLimit = await prisma.ftpQuotaLimits.findFirst({
      where: {
        name: ftpUser.userid,
      },
    });

    const quotaUsed = await prisma.ftpquotatallies.findFirst({
      where: {
        name: ftpUser.userid,
      },
    });

    if (!quotaLimit || !quotaUsed) {
      return {
        used: 0,
        available: 0,
      };
    }

    return {
      used: quotaUsed.bytes_out_used,
      available: quotaLimit.bytes_out_avail,
    };
  },
);
