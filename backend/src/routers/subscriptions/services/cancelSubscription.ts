import { PrismaClient, Users } from '@prisma/client';
import { subDays } from 'date-fns';
import { log } from '../../../server';
import { gbToBytes } from '../../../utils/gbToBytes';

export const cancelSubscription = async ({
  prisma,
  user,
}: {
  prisma: PrismaClient;
  user: Users;
}) => {
  const download = await prisma.descargasUser.findFirst({
    where: {
      AND: [
        {
          user_id: user.id,
        },
        {
          date_end: {
            gte: new Date().toISOString(),
          },
        },
      ],
    },
  });

  if (!download) {
    log.info(
      `[CANCEL_SUB] No active subscription for user ${user.id}, no action taken to cancel subscription`,
    );

    return;
  }

  const quotaTallies = await prisma.ftpquotatallies.findFirst({
    where: {
      name: user.username,
    },
  });

  if (!quotaTallies) {
    log.info(
      `[CANCEL_SUB] No quota tallies found for user ${user.id}, no action taken to cancel subscription`,
    );
    return;
  }

  const ftpUser = await prisma.ftpUser.findFirst({
    where: {
      user_id: user.id,
    },
  });

  if (!ftpUser) {
    log.info(
      `[CANCEL_SUB] No ftp user found for user ${user.id}, no action taken to cancel subscription`,
    );
    return;
  }

  await prisma.$transaction([
    prisma.descargasUser.update({
      where: {
        id: download.id,
      },
      data: {
        date_end: subDays(new Date(), 1),
      },
    }),
    prisma.ftpquotatallies.update({
      where: {
        id: quotaTallies.id,
      },
      data: {
        bytes_out_used: gbToBytes(500) + gbToBytes(1),
      },
    }),
    prisma.ftpUser.update({
      where: {
        id: ftpUser.id,
      },
      data: {
        expiration: subDays(new Date(), 1).toISOString(),
      },
    }),
  ]);
};
