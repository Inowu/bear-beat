import { PrismaClient, Users } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { SessionUser } from '../../auth/utils/serialize-user';
import stripeInstance from '../../../stripe';
import { log } from '../../../server';
import { conektaSubscriptions } from '../../../conekta';
import { SubscriptionService } from '../services/types';
import axios from 'axios';
import { paypal } from '../../../paypal';

export const hasActiveSubscription = async ({
  user,
  customerId,
  prisma,
  service,
}:
  | {
      user: SessionUser;
      customerId: string;
      prisma: PrismaClient;
      service: SubscriptionService.STRIPE | SubscriptionService.CONEKTA;
    }
  | {
      user: SessionUser;
      customerId: number;
      prisma: PrismaClient;
      service: SubscriptionService.PAYPAL;
    }
  | {
      user: Users;
      customerId?: never;
      prisma: PrismaClient;
      service: SubscriptionService.ADMIN;
    }) => {
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

  switch (service) {
    case SubscriptionService.STRIPE:
      const existingStripeSubscription =
        await stripeInstance.subscriptions.list({
          customer: customerId,
          status: 'active',
        });

      if (existingStripeSubscription.data.length > 0) {
        log.error(
          '[SUBSCRIPTION_CHECK] User already has an active stripe subscription',
        );
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'There is already an active subscription for this user',
        });
      }

      break;
    case SubscriptionService.CONEKTA:
      try {
        const existingConektaSubscription =
          (await conektaSubscriptions.getSubscription(customerId)).data
            .status === 'active';

        if (existingConektaSubscription) {
          log.error(
            '[SUBSCRIPTION_CHECK] User already has an active conekta subscription',
          );

          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'There is already an active subscription for this user',
          });
        }
      } catch (e) {}

      break;
    default:
      break;
  }
};
