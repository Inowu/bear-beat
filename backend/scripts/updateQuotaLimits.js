const { PrismaClient } = require('@prisma/client');
const { config } = require('dotenv');

config();

const prisma = new PrismaClient();

const gbToBytes = (gb) =>
  gb ? gb * 1024 * 1024 * 1024 : 500 * 1024 * 1024 * 1024;

async function updateQuotaLimitsFromSub() {
  const activeSubscriptions = await prisma.descargasUser.findMany({
    where: {
      date_end: {
        gte: new Date(),
      },
    },
  });

  for (const sub of activeSubscriptions) {
    if (!sub.order_id) {
      continue;
    }

    const order = await prisma.orders.findFirst({
      where: {
        id: sub.order_id,
      },
    });

    if (!order || !order.plan_id) {
      console.log(`Order doesn't exist, order_id ${sub.order_id}`);
      continue;
    }

    const plan = await prisma.plans.findFirst({
      where: {
        id: order.plan_id,
      },
    });

    if (!plan) {
      console.log(`Plan doesn't exist, plan_id ${order.plan_id}`);
      continue;
    }

    if (plan.duration !== '365') {
      console.log(`Plan ${plan.name} is not annual`);
      continue;
    }

    const gb = gbToBytes(Number(plan.gigas));

    const ftpUser = await prisma.ftpUser.findFirst({
      where: {
        user_id: sub.user_id,
      },
    });

    if (!ftpUser) {
      console.log(`User ${sub.user_id} doesn't have an ftp account`);
      continue;
    }

    const quotaLimits = await prisma.ftpQuotaLimits.findFirst({
      where: {
        name: ftpUser.userid,
      },
    });

    if (!quotaLimits) {
      console.log(`User ${sub.user_id} doesn't have quota limits`);
      continue;
    }

    const quotaTallies = await prisma.ftpquotatallies.findFirst({
      where: {
        name: ftpUser.userid,
      },
    });

    if (!quotaTallies) {
      console.log(`User ${sub.user_id} doesn't have quota limits`);
      continue;
    }

    // Check if the plan is annual and if it has been more than 30 days since the last update
    const lastUpdate = quotaTallies.last_renewed_at;
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

    if (lastUpdate < oneMonthAgo) {
      console.log(`Updating user ${sub.user_id} with ${gb} bytes`);
      // Reset the used gigas to 0
      await prisma.ftpquotatallies.update({
        where: {
          id: quotaTallies.id,
        },
        data: {
          bytes_out_used: 0,
          last_renewed_at: new Date(),
        },
      });

      await prisma.ftpQuotaLimits.update({
        where: {
          id: quotaLimits.id,
        },
        data: {
          bytes_out_avail: gbToBytes(Number(plan.gigas)),
          bytes_xfer_avail: 0,
          files_xfer_avail: 0,
          files_out_avail: 0,
          // A limit of 0 means unlimited
          bytes_in_avail: 1,
          files_in_avail: 1,
          name: ftpUser.userid,
        },
      }),
        console.log(`Reset gigas used for user ${sub.user_id}`);
    }
  }
}

updateQuotaLimitsFromSub().then(() => {
  console.log('Updated quota limits successfully');
});
