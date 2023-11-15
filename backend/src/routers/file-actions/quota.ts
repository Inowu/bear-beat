import { z } from 'zod';
import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { FtpUser } from '@prisma/client';
import { extendedAccountPostfix } from '../../utils/constants';

/**
 * Returns the number of bytes used by the user and the number of
 * available bytes
 * */
export const quota = shieldedProcedure
  .input(
    z.object({
      isExtended: z.boolean().optional(),
    }),
  )
  .query(async ({ ctx: { prisma, session }, input: { isExtended } }) => {
    const user = session!.user!;

    let ftpUser: FtpUser | null = null;

    if (isExtended) {
      ftpUser = await prisma.ftpUser.findFirst({
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
    } else {
      ftpUser = await prisma.ftpUser.findFirst({
        where: {
          user_id: user.id,
        },
      });
    }

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
  });
