import { PrismaClient } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { SessionUser } from '../../auth/utils/serialize-user';
import stripeInstance from '../../../stripe';
import { log } from '../../../server';

export const hasActiveSubscription = async (
  user: SessionUser,
  stripeCustomerId: string,
  prisma: PrismaClient,
  service = 'stripe',
) => {
  if (service === 'stripe') {
    const existingStripeSubscription = await stripeInstance.subscriptions.list({
      customer: stripeCustomerId,
      status: 'active',
    });

    if (existingStripeSubscription.data.length > 0) {
      log.error('User already has an active stirpe subscription');
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'There is already an active subscription for this user',
      });
    }
  }

  const existingSubscription = await prisma.descargasUser.findFirst({
    where: {
      AND: [
        { user_id: user.id },
        {
          date_end: {
            gte: new Date().toISOString(),
          },
        },
      ],
    },
  });

  if (existingSubscription) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'There is already an active subscription for this user',
    });
  }
};
