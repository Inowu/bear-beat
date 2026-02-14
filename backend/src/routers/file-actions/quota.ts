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

    const [ftpUserRegular, ftpUserExtended] = await Promise.all([
      prisma.ftpUser.findFirst({
        where: {
          user_id: user.id,
          NOT: {
            userid: { endsWith: extendedAccountPostfix },
          },
        },
      }),
      prisma.ftpUser.findFirst({
        where: {
          user_id: user.id,
          userid: { endsWith: extendedAccountPostfix },
        },
      }),
    ]);

    if (!ftpUserRegular && !ftpUserExtended) {
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

    const [quotaLimit, quotaUsed, quotaLimitExtended, quotaUsedExtended] =
      await Promise.all([
        ftpUserRegular
          ? prisma.ftpQuotaLimits.findFirst({
              where: { name: ftpUserRegular.userid },
            })
          : Promise.resolve(null),
        ftpUserRegular
          ? prisma.ftpquotatallies.findFirst({
              where: { name: ftpUserRegular.userid },
            })
          : Promise.resolve(null),
        ftpUserExtended
          ? prisma.ftpQuotaLimits.findFirst({
              where: { name: ftpUserExtended.userid },
            })
          : Promise.resolve(null),
        ftpUserExtended
          ? prisma.ftpquotatallies.findFirst({
              where: { name: ftpUserExtended.userid },
            })
          : Promise.resolve(null),
      ]);

    const regularQuota = quotaLimit && quotaUsed
      ? { used: quotaUsed.bytes_out_used, available: quotaLimit.bytes_out_avail }
      : { used: BigInt(0), available: BigInt(0) };

    const extendedQuota = quotaLimitExtended && quotaUsedExtended
      ? { used: quotaUsedExtended.bytes_out_used, available: quotaLimitExtended.bytes_out_avail }
      : { used: BigInt(0), available: BigInt(0) };

    return { regular: regularQuota, extended: extendedQuota };
  });
