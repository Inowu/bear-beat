import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../procedures/shielded.procedure';

/**
 * Returns the number of bytes used by the user and the number of
 * available bytes
 * */
export const quota = shieldedProcedure.query(
  async ({ ctx: { prisma, session } }) => {
    const { user } = session!;

    const quotaLimit = await prisma.ftpQuotaLimits.findFirst({
      where: {
        name: user?.username,
      },
    });

    const quotaUsed = await prisma.ftpquotatallies.findFirst({
      where: {
        name: user?.username,
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
