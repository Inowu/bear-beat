import { TRPCError } from '@trpc/server';
import { PrismaClient } from '@prisma/client';
import stripeInstance from '../../../stripe';
import { log } from '../../../server';
import { SessionUser } from '../../auth/utils/serialize-user';

export const cancelStripeSubscription = async ({
  prisma,
  user,
}: {
  prisma: PrismaClient;
  user: SessionUser;
}) => {
  const dbUser = await prisma.users.findFirst({
    where: {
      id: user.id,
    },
  });

  const subscriptions = await stripeInstance.subscriptions.list({
    customer: dbUser!.stripe_cusid!,
    status: 'active',
  });

  if (subscriptions.data.length === 0) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'El usuario no tiene una suscripción activa.',
    });
  }

  const subscription = subscriptions.data[0];

  log.info(`[STRIPE:CANCEL] Canceling subscription ${subscription.id}`);
  await stripeInstance.subscriptions.cancel(subscriptions.data[0].id);

  return { message: 'Tu suscripción ha sido cancelada con correctamente.' };
};
