import crypto from 'crypto';
import { Users, Plans, PrismaClient, Orders } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { gbToBytes } from '../../../utils/gbToBytes';
import { log } from '../../../server';
import { OrderStatus } from '../interfaces/order-status.interface';
import { Params, SubscriptionService } from './types';
import { SessionUser } from '../../auth/utils/serialize-user';

export const subscribe = async ({
  prisma,
  user,
  plan,
  orderId: metaOrderId,
  subId,
  service,
  expirationDate,
}: Params) => {
  const ftpUser = await prisma.ftpUser.findFirst({
    where: {
      user_id: user.id,
    },
  });

  let dbPlan: Plans | null | undefined = plan;

  const orderId = Number(metaOrderId);

  if (!plan) {
    log.info(`[SUBSCRIPTION] Fetching order with id ${orderId}`);
    const order = await prisma.orders.findFirstOrThrow({
      where: {
        id: orderId,
      },
    });

    if (order.status === OrderStatus.PAID) {
      log.error(`[SUBSCRIPTION] This order was already paid, ${orderId}`);
      return;
    }

    if (!order.plan_id) {
      log.error(`[SUBSCRIPTION] This order did not have a plan id, ${orderId}`);

      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'The given order did not have a plan id',
      });
    }

    log.info(`[SUBSCRIPTION] Fetching plan with id ${order.plan_id}`);
    dbPlan = await prisma.plans.findFirst({
      where: {
        id: order.plan_id,
      },
    });
  }

  if (!dbPlan) {
    log.warn(
      `[SUBSCRIPTION] Could not find plans with id ${plan?.id}, orderId ${orderId}. No action was taken`,
    );

    return;
  }

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
            expiration: expirationDate,
          },
        }),
        prisma.descargasUser.create({
          data: {
            available: 500,
            date_end: expirationDate.toISOString(),
            user_id: user.id,
            ...(orderId ? { order_id: orderId } : {}),
          },
        }),
      ]);

      if (
        service === SubscriptionService.ADMIN ||
        service === SubscriptionService.PAYPAL
      ) {
        await prisma.orders.create({
          data: {
            txn_id: subId,
            user_id: user.id,
            status: OrderStatus.PAID,
            is_plan: 1,
            plan_id: dbPlan?.id,
            payment_method: service,
            date_order: new Date().toISOString(),
            total_price: Number(dbPlan?.price),
          },
        });
      }

      if (orderId) {
        await prisma.orders.update({
          where: {
            id: orderId,
          },
          data: {
            status: OrderStatus.PAID,
          },
        });
      }
    } catch (e) {
      log.error(`Error while creating ftp user: ${e}`);
    }
  } else {
    log.info(`[SUBSCRIPTION] Renovating subscription for user ${user.id}`);

    try {
      const [existingTallies, existingLimits] = await Promise.all([
        prisma.ftpquotatallies.findFirst({
          where: {
            name: ftpUser.userid,
          },
        }),
        prisma.ftpQuotaLimits.findFirst({
          where: {
            name: ftpUser.userid,
          },
        }),
      ]);

      let talliesId = existingTallies?.id;
      let limitsId = existingLimits?.id;

      if (!existingTallies) {
        const tallies = await prisma.ftpquotatallies.create({
          data: {
            name: ftpUser.userid,
          },
        });

        talliesId = tallies.id;
      }

      if (!existingLimits) {
        const limits = await prisma.ftpQuotaLimits.create({
          data: {
            bytes_out_avail: gbToBytes(Number(dbPlan?.gigas)),
            bytes_xfer_avail: 0,
            // A limit of 0 means unlimited
            files_out_avail: 0,
            bytes_in_avail: 1,
            files_in_avail: 1,
            name: ftpUser.userid,
          },
        });

        limitsId = limits.id;
      }

      // Renovation
      await prisma.$transaction([
        prisma.ftpquotatallies.update({
          where: {
            id: talliesId,
          },
          data: {
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
            name: ftpUser.userid,
          },
        }),
        prisma.ftpUser.update({
          where: {
            id: ftpUser.id,
          },
          data: {
            expiration: expirationDate,
          },
        }),
      ]);

      log.info(`[SUBSCRIPTION] Creating order for user ${user.id}`);

      const order = await prisma.orders.create({
        data: {
          txn_id: subId,
          user_id: user.id,
          status: OrderStatus.PAID,
          is_plan: 1,
          plan_id: dbPlan?.id,
          payment_method: service,
          date_order: new Date().toISOString(),
          total_price: Number(dbPlan?.price),
        },
      });

      log.info(
        `[SUBSCRIPTION] Creating descargas user entry for user ${user.id}`,
      );
      // }

      await insertInDescargas({ expirationDate, user, prisma, order });
    } catch (e) {
      log.error(`Error while renovating subscription: ${e}`);
    }
  }
};

const insertFtpQuotas = ({
  prisma,
  user,
  plan,
}: {
  prisma: PrismaClient;
  user: Users | SessionUser;
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

const insertInDescargas = ({
  expirationDate,
  user,
  order,
  prisma,
}: {
  prisma: PrismaClient;
  expirationDate: Date;
  user: Users | SessionUser;
  order: Orders;
}) =>
  prisma.descargasUser.create({
    data: {
      available: 500,
      date_end: expirationDate.toISOString(),
      user_id: user.id,
      order_id: order.id,
    },
  });
