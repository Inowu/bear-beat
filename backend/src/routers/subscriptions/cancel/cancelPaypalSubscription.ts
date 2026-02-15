import { TRPCError } from '@trpc/server';
import axios from 'axios';
import { PrismaClient, Users } from '@prisma/client';
import { log } from '../../../server';
import { paypal } from '../../../paypal';
import { SessionUser } from '../../auth/utils/serialize-user';

export const cancelPaypalSubscription = async ({
  prisma,
  user,
}: {
  prisma: PrismaClient;
  user: SessionUser | Users;
}) => {
  const descargasUser = await prisma.descargasUser.findFirst({
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

  if (!descargasUser) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El usuario no tiene una suscripción activa.',
    });
  }

  const order = await prisma.orders.findFirst({
    where: {
      id: descargasUser.order_id!,
    },
  });

  if (!order) {
    log.error('[PAYPAL:CANCEL] Order not found for active subscription');

    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El usuario no tiene una suscripción activa.',
    });
  }

  const token = await paypal.getToken();

  try {
    await axios.post(
      `${paypal.paypalUrl()}/v1/billing/subscriptions/${order.txn_id}/cancel`,
      {
        reason: 'Canceling the subscription',
      },
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    log.info('[PAYPAL:CANCEL] Cancelled subscription');

    return { message: 'Tu suscripción ha sido cancelada con correctamente.' };
  } catch (e) {
    log.error('[PAYPAL:CANCEL] Failed to cancel subscription', {
      errorType: e instanceof Error ? e.name : typeof e,
    });

    return { error: 'Ocurrió un error al cancelar la suscripción.' };
  }
};
