import crypto from 'crypto';
import { Users, Plans, PrismaClient } from '@prisma/client';
import { addMonths } from 'date-fns';
import { TRPCError } from '@trpc/server';
import { gbToBytes } from '../../../utils/gbToBytes';

export const subscribe = async ({
  prisma,
  user,
  plan,
}: {
  plan: Plans;
  prisma: PrismaClient;
  user: Users;
}) => {
  const ftpUser = await prisma.ftpUser.findFirst({
    where: {
      userid: user.username,
    },
  });

  const expiration = addMonths(new Date(), 1);

  // Hasn't subscribed before
  if (!ftpUser) {
    await prisma.$transaction([
      prisma.ftpQuotaLimits.create({
        data: {
          bytes_out_avail: gbToBytes(Number(plan.gigas)),
          // A limit of 0 means unlimited
          bytes_in_avail: 1,
          bytes_xfer_avail: 1,
          files_in_avail: 1,
          files_out_avail: 1,
          files_xfer_avail: 1,
          name: user.username,
        },
      }),
      prisma.ftpquotatallies.create({
        data: {
          name: user.username,
        },
      }),
      prisma.ftpUser.create({
        data: {
          userid: user.username,
          user_id: user.id,
          homedir: plan.homedir,
          passwd: crypto.randomBytes(15).toString('base64'),
          expiration,
        },
      }),
      prisma.descargasUser.create({
        data: {
          available: 500,
          date_end: addMonths(new Date(), 1).toISOString(),
          user_id: user.id,
        },
      }),
    ]);
  } else {
    const tallies = await prisma.ftpquotatallies.findFirst({
      where: {
        name: user.username,
      },
    });

    if (!tallies) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'No quota tallies were found for the specified user',
      });
    }

    // Renovation
    await prisma.$transaction([
      prisma.ftpquotatallies.update({
        where: {
          id: tallies?.id,
        },
        data: {
          name: user.username,
          bytes_out_used: 0,
        },
      }),
      prisma.ftpUser.update({
        where: {
          id: ftpUser.id,
        },
        data: {
          expiration,
        },
      }),
      prisma.descargasUser.create({
        data: {
          available: 500,
          date_end: addMonths(new Date(), 1).toISOString(),
          user_id: user.id,
        },
      }),
    ]);
  }
};
