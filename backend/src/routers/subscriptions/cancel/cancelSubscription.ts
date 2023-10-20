import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import { SubscriptionService } from '../services/types';
import { cancelStripeSubscription } from './cancelStripeSubscription';
import { cancelPaypalSubscription } from './cancelPaypalSubscription';

export const requestSubscriptionCancellation = shieldedProcedure.mutation(
  async ({ ctx: { prisma, session } }) => {
    const user = session!.user!;

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
      case SubscriptionService.STRIPE:
        await cancelStripeSubscription({ prisma, user });
        break;
      case SubscriptionService.PAYPAL:
        await cancelPaypalSubscription({ prisma, user });
        break;
      default:
        break;
    }
  },
);
