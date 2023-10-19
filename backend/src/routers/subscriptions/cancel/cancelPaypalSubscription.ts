import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import stripeInstance from '../../../stripe';
import { log } from '../../../server';
import { paypal } from '../../../paypal';
import axios from 'axios';

export const cancelPaypalSubscription = shieldedProcedure.mutation(
  async ({ ctx: { prisma, session } }) => {
    const user = session!.user!;

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
      log.error(
        `[PAYPAL:CANCEL] Order ${descargasUser.order_id} not found. User: ${user.id}`,
      );

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

      log.info(`[PAYPAL:CANCEL] Cancelled subscription for user ${user.id}`);

      return { message: 'Tu suscripción ha sido cancelada con correctamente.' };
    } catch (e) {
      log.error(
        `[PAYPAL:CANCEL] An error happened while creating subscription with paypal ${e}`,
      );

      return { error: 'Ocurrió un error al cancelar la suscripción.' };
    }
  },
);
