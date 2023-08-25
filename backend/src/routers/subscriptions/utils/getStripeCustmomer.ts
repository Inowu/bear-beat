import { PrismaClient } from '@prisma/client';
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

  if (existingCustomer?.stripe_cusid) return existingCustomer.stripe_cusid;

  const newCustomer = await stripeInstance.customers.create({
    email: user.email,
    name: user.username,
    metadata: {
      id: user.id,
    },
  });

  return newCustomer.id;
};
