import { TRPCError } from '@trpc/server';
import { PrismaClient, Users } from '@prisma/client';
import stripeInstance from '../../../stripe';
import { log } from '../../../server';
import { SessionUser } from '../../auth/utils/serialize-user';
import { getStripeCustomer } from '../utils/getStripeCustomer';

export const cancelStripeSubscription = async ({
  prisma,
  user,
}: {
  prisma: PrismaClient;
  user: SessionUser | Users;
}) => {
  const stripeCustomerId = await getStripeCustomer(prisma, user as SessionUser);

  const subscriptions = await stripeInstance.subscriptions.list({
    customer: stripeCustomerId,
    status: 'active',
  });

  const trialSubscription = await stripeInstance.subscriptions.list({
    customer: stripeCustomerId,
    status: 'trialing',
  });

  const activeSubscription = [
    ...subscriptions.data,
    ...trialSubscription.data,
  ];

  if (activeSubscription.length === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El usuario no tiene una suscripción activa.',
    });
  }

  const subscription = activeSubscription[0];

  try {
    log.info('[STRIPE:CANCEL] Canceling subscription');

    await stripeInstance.subscriptions.cancel(subscription.id);

    return { message: 'Tu suscripción ha sido cancelada con correctamente.' };
  } catch (e: any) {
    log.error('[STRIPE:CANCEL] Error canceling subscription', {
      errorType: e instanceof Error ? e.name : typeof e,
    });

    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Error al cancelar la suscripción.',
    });
  }
};
