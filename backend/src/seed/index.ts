import { addMonths } from 'date-fns';
import { prisma } from '../db';
import { appRouter } from '../routers';
import { gbToBytes } from '../utils/gbToBytes';

export const seed = async () => {
  const caller = appRouter.createCaller({
    req: {} as any,
    res: {} as any,
    prisma,
    session: null,
  });

  let user = await prisma.users.findFirst({
    where: {
      email: 'test@test.com',
    },
  });

  if (user) {
    await prisma.users.delete({
      where: {
        id: user.id,
      },
    });
  }

  await caller.auth.register({
    email: 'test@test.com',
    username: 'test',
    password: 'password',
    phone: '534205355',
  });

  user = await prisma.users.findFirst({
    where: {
      email: 'test@test.com',
    },
  });

  await prisma.ftpquotatallies.create({
    data: {
      name: 'test',
    },
  });

  await prisma.ftpQuotaLimits.create({
    data: {
      name: 'test',
      bytes_out_avail: gbToBytes(500),
      bytes_xfer_avail: 0,
      // A limit of 0 means unlimited
      files_out_avail: 0,
      bytes_in_avail: 1,
      files_in_avail: 1,
    },
  });

  await prisma.descargasUser.create({
    data: {
      available: 500,
      date_end: addMonths(new Date(), 12).toISOString(),
      user_id: user!.id,
    },
  });
};
