const { PrismaClient } = require('@prisma/client');
const { config } = require('dotenv');

config();

const prisma = new PrismaClient();

const gbToBytes = (gb) => gb ? gb * 1024 * 1024 * 1024 : 500 * 1024 * 1024 * 1024;

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

    const gb = gbToBytes(Number(plan.gigas));

    console.log(`Updating user ${sub.user_id} with ${gb} bytes`);

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

    await prisma.ftpQuotaLimits.update({
      where: {
        id: quotaLimits.id,
      },
      data: {
        bytes_out_avail: gb,
      },
    });
  }
}

updateQuotaLimitsFromSub().then(() => {
  console.log('Updated quota limits successfully');
});
