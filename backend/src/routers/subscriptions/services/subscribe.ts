import crypto from 'crypto';
import { Users, Plans, PrismaClient } from '@prisma/client';
import { addMonths } from 'date-fns';
import { TRPCError } from '@trpc/server';
import { gbToBytes } from '../../../utils/gbToBytes';
import { log } from '../../../server';
import { OrderStatus } from '../interfaces/order-status.interface';

export const subscribe = async ({
  prisma,
  user,
  plan,
  orderId: metaOrderId,
}:
  | {
      plan: Plans;
      prisma: PrismaClient;
      user: Users;
      orderId?: never;
    }
  | {
      prisma: PrismaClient;
      user: Users;
      orderId: string;
      plan?: never;
    }) => {
  const ftpUser = await prisma.ftpUser.findFirst({
    where: {
      userid: user.username,
    },
  });

  const expiration = addMonths(new Date(), 1);

  let dbPlan = plan;

  const orderId = Number(metaOrderId);

  if (!plan) {
    const order = await prisma.orders.findFirstOrThrow({
      where: {
        id: orderId,
      },
    });

    if (order.status === OrderStatus.PAYED) {
      log.error(`This order was already paid, ${orderId}`);
      return;
    }

    if (!order.plan_id) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'The given order did not have a plan id',
      });
    }

    dbPlan = await prisma.plans.findFirstOrThrow({
      where: {
        id: order.plan_id,
      },
    });
  }

  if (!dbPlan) return;

  // Hasn't subscribed before
  if (!ftpUser) {
    log.info(`[SUBSCRIPTION] Creating new subscription for user ${user.id}`);

    try {
      await prisma.$transaction([
        ...insertFtpQuotas({ prisma, user, plan: dbPlan }),
        prisma.ftpUser.create({
          data: {
            userid: user.username,
            user_id: user.id,
            homedir: dbPlan.homedir,
            uid: 2001,
            gid: 2001,
            passwd: crypto.randomBytes(15).toString('base64'),
            expiration,
          },
        }),
        prisma.descargasUser.create({
          data: {
            available: 500,
            date_end: addMonths(new Date(), 1).toISOString(),
            user_id: user.id,
            ...(orderId ? { order_id: orderId } : {}),
          },
        }),
      ]);
    } catch (e) {
      log.error(`Error while creating ftp user: ${e}`);
    }
  } else {
    log.info(`[SUBSCRIPTION] Renovating subscription for user ${user.id}`);

    try {
      const [existingTallies, existingLimits] = await Promise.all([
        prisma.ftpquotatallies.findFirst({
          where: {
            name: user.username,
          },
        }),
        prisma.ftpQuotaLimits.findFirst({
          where: {
            name: user.username,
          },
        }),
      ]);

      let talliesId = existingTallies?.id;
      let limitsId = existingLimits?.id;

      if (!existingTallies && !existingLimits) {
        const [limits, tallies] = await prisma.$transaction(
          insertFtpQuotas({ prisma, user, plan: dbPlan }),
        );

        talliesId = tallies.id;
        limitsId = limits.id;
      }

      // Renovation
      await prisma.$transaction([
        prisma.ftpquotatallies.update({
          where: {
            id: talliesId,
          },
          data: {
            name: user.username,
            bytes_out_used: 0,
          },
        }),
        prisma.ftpQuotaLimits.update({
          where: {
            id: limitsId,
          },
          data: {
            bytes_out_avail: gbToBytes(Number(dbPlan.gigas)),
            bytes_xfer_avail: 0,
            files_xfer_avail: 0,
            files_out_avail: 0,
            // A limit of 0 means unlimited
            bytes_in_avail: 1,
            files_in_avail: 1,
            name: user.username,
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
            ...(orderId ? { order_id: orderId } : {}),
          },
        }),
      ]);
    } catch (e) {
      log.error(`Error while renovating subscription: ${e}`);
    }
  }

  if (orderId) {
    await prisma.orders.update({
      where: {
        id: orderId,
      },
      data: {
        status: OrderStatus.PAYED,
      },
    });
  }
};

const insertFtpQuotas = ({
  prisma,
  user,
  plan,
}: {
  prisma: PrismaClient;
  user: Users;
  plan: Plans;
}) => [
  prisma.ftpQuotaLimits.create({
    data: {
      bytes_out_avail: gbToBytes(Number(plan.gigas)),
      bytes_xfer_avail: 0,
      // A limit of 0 means unlimited
      files_out_avail: 0,
      bytes_in_avail: 1,
      files_in_avail: 1,
      name: user.username,
    },
  }),
  prisma.ftpquotatallies.create({
    data: {
      name: user.username,
    },
  }),
];
