/*
 * This script updates the table of bytes used by users and sets the user's total to the limit to make sure inactive users cannot download through ftp
 * */

const { PrismaClient } = require('@prisma/client');
const { config } = require('dotenv');

config();

const prisma = new PrismaClient();

async function updateInactiveUsersQuota() {
  const activeUsers = await prisma.descargasUser.findMany({
    where: {
      date_end: {
        gte: new Date(),
      },
    },
    distinct: ['user_id'],
  });

  const inactiveFtpUsers = await prisma.ftpUser.findMany({
    where: {
      NOT: {
        user_id: {
          in: activeUsers.map((user) => user.user_id),
        },
      },
    },
  });

  for (const user of inactiveFtpUsers) {
    const quotaLimit = await prisma.ftpQuotaLimits.findFirst({
      where: {
        name: user.userid,
      },
    });

    const quotaTally = await prisma.ftpquotatallies.findFirst({
      where: {
        name: user.userid,
      },
    });

    if (!quotaTally) {
      console.log('No quota tally found for user', user.userid);
      continue;
    }

    console.log('Updating quota for inactive user: ', user.userid);

    await prisma.ftpquotatallies.update({
      where: {
        id: quotaTally.id,
      },
      data: {
        bytes_out_used: quotaLimit?.bytes_out_avail || 536870912000,
      },
    });
  }
}

updateInactiveUsersQuota().then(() => {
  console.log('Tallies for inactive users updated');
});
