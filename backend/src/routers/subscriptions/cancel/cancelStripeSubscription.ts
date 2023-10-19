import { TRPCError } from '@trpc/server';
import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import stripeInstance from '../../../stripe';
import { log } from '../../../server';

export const cancelStripeSubscription = shieldedProcedure.mutation(
  async ({ ctx: { prisma, session } }) => {
    const user = session!.user!;

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
  },
);
