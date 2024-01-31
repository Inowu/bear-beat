import { TRPCError } from '@trpc/server';
import { PaymentService } from '../services/types';
import { cancelStripeSubscription } from './cancelStripeSubscription';
import { cancelPaypalSubscription } from './cancelPaypalSubscription';
import { PrismaClient, Users } from '@prisma/client';
import { SessionUser } from '../../auth/utils/serialize-user';

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

  await prisma.descargasUser.update({
    where: {
      id: activeSubscription.id,
    },
    data: {
      date_end: new Date(),
    },
  });
};
