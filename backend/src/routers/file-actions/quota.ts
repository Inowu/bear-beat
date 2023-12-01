import { z } from 'zod';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { extendedAccountPostfix } from '../../utils/constants';

/**
 * Returns the number of bytes used by the user and the number of
 * available bytes
 * */
export const quota = shieldedProcedure
  .output(
    z.object({
      regular: z.object({
        used: z.bigint(),
        available: z.bigint(),
      }),
      extended: z.object({
        used: z.bigint(),
        available: z.bigint(),
      }),
    }),
  )
  .query(async ({ ctx: { prisma, session } }) => {
    const user = session!.user!;

    const ftpUserExtended = await prisma.ftpUser.findFirst({
      where: {
        AND: [
          {
            user_id: user.id,
          },
          {
            userid: {
              endsWith: extendedAccountPostfix,
            },
          },
        ],
      },
    });

    const ftpUser = await prisma.ftpUser.findFirst({
      where: {
        user_id: user.id,
      },
    });

    if (!ftpUser) {
      return {
        regular: {
          used: BigInt(0),
          available: BigInt(0),
        },
        extended: {
          used: BigInt(0),
          available: BigInt(0),
        },
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
        regular: {
          used: BigInt(0),
          available: BigInt(0),
        },
        extended: {
          used: BigInt(0),
          available: BigInt(0),
        },
      };
    }

    const regularQuota = {
      used: quotaUsed.bytes_out_used,
      available: quotaLimit.bytes_out_avail,
    };

    if (!ftpUserExtended) {
      return {
        regular: regularQuota,
        extended: {
          used: BigInt(0),
          available: BigInt(0),
        },
      };
    }

    const quotaLimitExtended = await prisma.ftpQuotaLimits.findFirst({
      where: {
        name: ftpUserExtended.userid,
      },
    });

    const quotaUsedExtended = await prisma.ftpquotatallies.findFirst({
      where: {
        name: ftpUserExtended.userid,
      },
    });

    if (!quotaUsedExtended || !quotaLimitExtended) {
      return {
        regular: regularQuota,
        extended: {
          used: BigInt(0),
          available: BigInt(0),
        },
      };
    }

    const extendedQuota = {
      used: quotaUsedExtended.bytes_out_used,
      available: quotaLimitExtended.bytes_out_avail,
    };

    return {
      regular: regularQuota,
      extended: extendedQuota,
    };
  });
