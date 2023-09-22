import crypto from 'crypto';
import { Users, Plans, PrismaClient } from '@prisma/client';
import { addDays } from 'date-fns';
import { TRPCError } from '@trpc/server';
import { gbToBytes } from '../../../utils/gbToBytes';
import { log } from '../../../server';
import { OrderStatus } from '../interfaces/order-status.interface';
import stripeInstance from '../../../stripe';

export enum SubscriptionService {
  STRIPE = 'Stripe',
  CONEKTA = 'Conekta',
  ADMIN = 'ADMIN',
  STRIPE_RENOVACION = 'Stripe Renovacion',
}

type Params =
  | {
      plan: Plans;
      prisma: PrismaClient;
      user: Users;
      subId: string;
      orderId?: never;
      service: SubscriptionService;
    }
  | {
      prisma: PrismaClient;
      user: Users;
      orderId: string;
      subId: string;
      plan?: never;
      service: SubscriptionService;
    };

export const subscribe = async ({
  prisma,
  user,
  plan,
  orderId: metaOrderId,
  subId,
  service,
}: Params) => {
  const ftpUser = await prisma.ftpUser.findFirst({
    where: {
      user_id: user.id,
    },
  });

  let dbPlan = plan;

  const orderId = Number(metaOrderId);

  if (!plan) {
    const order = await prisma.orders.findFirstOrThrow({
      where: {
        id: orderId,
      },
    });

    if (order.status === OrderStatus.PAID) {
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

  if (!dbPlan) {
    log.warn(
      `[SUBSCRIPTION] Could not find plans with id ${plan?.id}, orderId ${orderId}. No action was taken`,
    );

    return;
  }

  const planDurationInDays = Number.isInteger(dbPlan.duration)
    ? Number(dbPlan.duration)
    : 30;

  const expiration = addDays(new Date(), planDurationInDays);

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
            date_end: expiration.toISOString(),
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
            bytes_out_avail: gbToBytes(Number(plan?.gigas)),
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
            expiration,
          },
        }),
      ]);

      // Create a entry on this table if the user has no active subscription
      log.info(`[SUBSCRIPTION] Creating order for user ${user.id}`);

      const order = await prisma.orders.create({
        data: {
          txn_id: subId,
          user_id: user.id,
          status: OrderStatus.PENDING,
          is_plan: 1,
          plan_id: plan?.id,
          payment_method: service,
          date_order: new Date().toISOString(),
          total_price: Number(plan?.price),
        },
      });

      log.info(
        `[SUBSCRIPTION] Creating descargas user entry for user ${user.id}`,
      );

      await prisma.descargasUser.create({
        data: {
          available: 500,
          date_end: expiration.toISOString(),
          user_id: user.id,
          order_id: order.id,
        },
      });
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
