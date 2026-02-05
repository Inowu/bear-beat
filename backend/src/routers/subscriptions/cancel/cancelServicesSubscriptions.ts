import { TRPCError } from '@trpc/server';
import { PaymentService } from '../services/types';
import { cancelStripeSubscription } from './cancelStripeSubscription';
import { cancelPaypalSubscription } from './cancelPaypalSubscription';
import { PrismaClient, Users } from '@prisma/client';
import { SessionUser } from '../../auth/utils/serialize-user';
import { manyChat } from '../../../many-chat';

export const cancelServicesSubscriptions = async ({
  prisma,
  user,
}: {
  prisma: PrismaClient;
  user: SessionUser | Users;
}) => {
  const activeSubscription = await prisma.descargasUser.findFirst({
    where: {
      AND: [
        {
          user_id: user.id,
        },
        {
          date_end: {
            gt: new Date(),
          },
        },
      ],
    },
    orderBy: [
      {
        date_end: 'desc',
      },
      {
        id: 'desc'
      },
    ]
  });

  if (!activeSubscription) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El usuario no tiene una suscripción activa.',
    });
  }

  const order = await prisma.orders.findFirst({
    where: {
      id: activeSubscription.order_id!,
    },
  });

  if (!order) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El usuario no tiene una suscripción activa.',
    });
  }

  const service = order.payment_method;

  switch (service) {
    case PaymentService.STRIPE:
      await cancelStripeSubscription({ prisma, user });
      break;
    case PaymentService.PAYPAL:
      await cancelPaypalSubscription({ prisma, user });
      break;
    default:
      break;
  }

  await prisma.orders.update({
    where: {
      id: order.id,
    },
    data: {
      is_canceled: 1,
    },
  });

  const dbUser = await prisma.users.findFirst({
    where: { id: user.id },
  });
  if (dbUser) {
    manyChat.addTagToUser(dbUser, 'CANCELLED_SUBSCRIPTION').catch(() => {});
  }

  // Don't update descargar_user and quota tallies since after billing cycle they won't be able to download ever again.

  // const ftpAccounts = await prisma.ftpUser.findMany({
  //   where: {
  //     user_id: user.id,
  //   },
  // });

  // if (ftpAccounts.length > 0) {
  //   for (const account of ftpAccounts) {
  //     const accountTallies = await prisma.ftpquotatallies.findFirst({
  //       where: {
  //         name: account.userid,
  //       },
  //     });

  //     const accountLimits = await prisma.ftpQuotaLimits.findFirst({
  //       where: {
  //         name: account.userid,
  //       },
  //     });

  //     if (accountTallies && accountLimits) {
  //       await prisma.ftpquotatallies.update({
  //         where: {
  //           id: accountTallies.id,
  //         },
  //         data: {
  //           bytes_out_used: gbToBytes(Number(accountLimits.bytes_out_avail)),
  //         },
  //       });
  //     }
  //   }
  // }

  // await prisma.descargasUser.update({
  //   where: {
  //     id: activeSubscription.id,
  //   },
  //   data: {
  //     date_end: new Date(),
  //   },
  // });
};
