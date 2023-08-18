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
    log.error(`No active downloads for user ${user.id}`);

    return;
  }

  const quotaTallies = await prisma.ftpquotatallies.findFirst({
    where: {
      name: user.username,
    },
  });

  if (!quotaTallies) {
    log.error(`No quota tallies found for user ${user.id}`);
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
  ]);
};
