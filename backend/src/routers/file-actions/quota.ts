import { z } from 'zod';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { extendedAccountPostfix } from '../../utils/constants';

type QuotaBlock = {
  used: bigint;
  available: bigint;
};

export type UserQuotaSnapshot = {
  regular: QuotaBlock;
  extended: QuotaBlock;
};

const EMPTY_QUOTA: QuotaBlock = {
  used: BigInt(0),
  available: BigInt(0),
};

export async function getUserQuotaSnapshot(opts: {
  prisma: any;
  userId: number;
}): Promise<UserQuotaSnapshot> {
  const { prisma, userId } = opts;
  const [ftpUserRegular, ftpUserExtended] = await Promise.all([
    prisma.ftpUser.findFirst({
      where: {
        user_id: userId,
        NOT: {
          userid: { endsWith: extendedAccountPostfix },
        },
      },
    }),
    prisma.ftpUser.findFirst({
      where: {
        user_id: userId,
        userid: { endsWith: extendedAccountPostfix },
      },
    }),
  ]);

  if (!ftpUserRegular && !ftpUserExtended) {
    return {
      regular: EMPTY_QUOTA,
      extended: EMPTY_QUOTA,
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

  const regularQuota =
    quotaLimit && quotaUsed
      ? {
          used: quotaUsed.bytes_out_used,
          available: quotaLimit.bytes_out_avail,
        }
      : EMPTY_QUOTA;

  const extendedQuota =
    quotaLimitExtended && quotaUsedExtended
      ? {
          used: quotaUsedExtended.bytes_out_used,
          available: quotaLimitExtended.bytes_out_avail,
        }
      : EMPTY_QUOTA;

  return { regular: regularQuota, extended: extendedQuota };
}

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
    return getUserQuotaSnapshot({ prisma, userId: user.id });
  });
