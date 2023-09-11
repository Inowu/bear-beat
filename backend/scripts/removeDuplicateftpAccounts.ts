/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';

config();

const prisma = new PrismaClient();

async function main() {
  const userIds = await getActiveUsersWithMoreThanOneAccount();

  for (const id of userIds) {
    const accounts = await prisma.ftpUser.findMany({
      where: {
        user_id: id,
      },
      orderBy: {
        count: 'desc',
      },
    });

    const [first, ...rest] = accounts;

    for (const account of rest) {
      await prisma.ftpUser.delete({
        where: {
          id: account.id,
        },
      });
    }
  }
}

main();

async function getEachUserFtpAccount(ids: number[]) {
  const result = await prisma.ftpUser.groupBy({
    by: ['user_id', 'userid'],
    where: {
      user_id: {
        in: ids,
      },
    },
  });

  return result;
}

async function getActiveUsersWithMoreThanOneAccount() {
  const result = await prisma.ftpUser.groupBy({
    where: {
      user_id: {
        in: await getActiveUsers(),
      },
    },
    by: ['user_id'],
    having: {
      user_id: {
        _count: {
          gt: 1,
        },
      },
    },
  });

  return result.map((user) => user.user_id!);
}

async function getActiveUsers() {
  const active = await prisma.descargasUser.findMany({
    where: {
      date_end: {
        gt: new Date(),
      },
    },
  });

  const activeUsers = await prisma.ftpUser.findMany({
    where: {
      user_id: {
        in: active.map((user) => user.user_id),
      },
    },
  });

  return activeUsers.map((user) => user.user_id!);
}
