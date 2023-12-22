import { PrismaClient, Users } from '@prisma/client';
import { log } from '../../../server';
import { PaymentService } from './types';
import { OrderStatus } from '../interfaces/order-status.interface';

/*
 * This only updates the order status to cancelled, it does not actually cancel the subscription,
 * cancellation is done with other methods specific to each service
 * */
export const cancelSubscription = async ({
  prisma,
  user,
  // Keep this so calls to this function don't break
  plan: planId,
  service,
  reason = OrderStatus.CANCELLED,
}: {
  prisma: PrismaClient;
  user: Users;
  plan: string;
  service:
    | PaymentService.STRIPE
    | PaymentService.CONEKTA
    | PaymentService.PAYPAL;
  reason?: OrderStatus;
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
    log.info(
      `[CANCEL_SUB] No active subscription for user ${user.id}, no action taken to cancel subscription`,
    );

    return;
  }

  const ftpUser = await prisma.ftpUser.findFirst({
    where: {
      user_id: user.id,
    },
  });

  if (!ftpUser) {
    log.info(
      `[CANCEL_SUB] No ftp user found for user ${user.id}, no action taken to cancel subscription`,
    );
    return;
  }

  const quotaTallies = await prisma.ftpquotatallies.findFirst({
    where: {
      name: ftpUser.userid,
    },
  });

  if (!quotaTallies) {
    log.info(
      `[CANCEL_SUB] No quota tallies found for user ${user.id}, no action taken to cancel subscription`,
    );
    return;
  }

  // let gb = 500;
  //
  // const plan = await prisma.plans.findFirst({
  //   where: {
  //     [getPlanKey(service)]: planId,
  //   },
  // });
  //
  // if (plan) gb = Number(plan.gigas);

  // await prisma.$transaction([
  //   prisma.descargasUser.update({
  //     where: {
  //       id: download.id,
  //     },
  //     data: {
  //       date_end: subDays(new Date(), 1),
  //     },
  //   }),
  //   prisma.ftpquotatallies.update({
  //     where: {
  //       id: quotaTallies.id,
  //     },
  //     data: {
  //       bytes_out_used: gbToBytes(gb) + gbToBytes(1),
  //     },
  //   }),
  //   prisma.ftpUser.update({
  //     where: {
  //       id: ftpUser.id,
  //     },
  //     data: {
  //       expiration: subDays(new Date(), 1).toISOString(),
  //     },
  //   }),
  // ]);

  const pendingOrder = await prisma.orders.findFirst({
    where: {
      AND: [
        {
          status: OrderStatus.PENDING,
        },
        {
          payment_method: PaymentService.STRIPE,
        },
      ],
    },
  });

  if (pendingOrder) {
    await prisma.orders.update({
      where: {
        id: pendingOrder.id,
      },
      data: {
        status: reason,
      },
    });
  }
};
