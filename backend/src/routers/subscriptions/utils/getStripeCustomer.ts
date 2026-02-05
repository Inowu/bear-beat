import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { SessionUser } from '../../auth/utils/serialize-user';
import stripeInstance from '../../../stripe';

export const getStripeCustomer = async (
  prisma: PrismaClient,
  user: SessionUser,
): Promise<string> => {
  const existingCustomer = await prisma.users.findFirst({
    where: {
      email: user.email,
      username: user.username,
    },
  });

  if (existingCustomer?.stripe_cusid) {
    try {
      await stripeInstance.customers.retrieve(existingCustomer.stripe_cusid);
      return existingCustomer.stripe_cusid;
    } catch (e) {
      const stripeError = e as Stripe.errors.StripeError;
      const isNoSuchCustomer =
        stripeError?.code === 'resource_missing' ||
        (typeof stripeError?.message === 'string' && stripeError.message?.toLowerCase().includes('no such customer'));
      if (isNoSuchCustomer) {
        await prisma.users.update({
          where: { id: user.id },
          data: { stripe_cusid: null },
        });
      } else {
        throw e;
      }
    }
  }

  const newCustomer = await stripeInstance.customers.create({
    email: user.email,
    name: user.username,
    metadata: {
      id: user.id,
    },
  });

  await prisma.users.update({
    where: {
      id: user.id,
    },
    data: {
      stripe_cusid: newCustomer.id,
    },
  });

  return newCustomer.id;
};
