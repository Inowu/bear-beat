import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';
import { SessionUser } from '../../auth/utils/serialize-user';
import stripeInstance from '../../../stripe';
import { log } from '../../../server';

export const getStripeCustomer = async (
  prisma: PrismaClient,
  user: SessionUser,
): Promise<string> => {
  // User <-> Stripe Customer mapping must be stable across profile edits.
  // Always resolve by DB `users.id` (not by email/username).
  const dbUser = await prisma.users.findFirst({
    where: { id: user.id },
    select: { id: true, email: true, username: true, stripe_cusid: true },
  });

  if (!dbUser) {
    throw new Error('No se pudo resolver el usuario para Stripe.');
  }

  const isNoSuchCustomerError = (e: unknown): boolean => {
    const stripeError = e as Stripe.errors.StripeError;
    return (
      stripeError?.code === 'resource_missing' ||
      (typeof stripeError?.message === 'string' &&
        stripeError.message.toLowerCase().includes('no such customer'))
    );
  };

  const maybeSyncCustomerFields = async (customerId: string, customer: Stripe.Customer) => {
    const updateParams: Stripe.CustomerUpdateParams = {};

    // Keep Stripe in sync (best-effort). This helps receipts, portal, and support workflows.
    if (dbUser.email && customer.email !== dbUser.email) updateParams.email = dbUser.email;
    if (dbUser.username && customer.name !== dbUser.username) updateParams.name = dbUser.username;

    // Backward compatible metadata keys (older customers used `id`).
    const desiredId = String(dbUser.id);
    const needsId = customer.metadata?.id !== desiredId;
    const needsUserId = (customer.metadata as any)?.userId !== desiredId;
    if (needsId || needsUserId) {
      updateParams.metadata = {
        ...(customer.metadata ?? {}),
        ...(needsId ? { id: desiredId } : {}),
        ...(needsUserId ? { userId: desiredId } : {}),
      };
    }

    if (Object.keys(updateParams).length === 0) return;

    try {
      await stripeInstance.customers.update(customerId, updateParams);
    } catch (e) {
      log.debug('[STRIPE_CUSTOMER] Customer sync skipped', {
        userId: dbUser.id,
        customerId,
        error: e instanceof Error ? e.message : e,
      });
    }
  };

  if (dbUser.stripe_cusid) {
    try {
      const customer = await stripeInstance.customers.retrieve(dbUser.stripe_cusid);
      if ((customer as any)?.deleted) {
        await prisma.users.update({
          where: { id: user.id },
          data: { stripe_cusid: null },
        });
      } else {
        await maybeSyncCustomerFields(dbUser.stripe_cusid, customer as Stripe.Customer);
        return dbUser.stripe_cusid;
      }
    } catch (e) {
      if (isNoSuchCustomerError(e)) {
        await prisma.users.update({
          where: { id: user.id },
          data: { stripe_cusid: null },
        });
      } else {
        throw e;
      }
    }
  }

  // Best-effort recovery: if `stripe_cusid` is missing in DB but we previously created a Customer,
  // try to re-link by email + metadata match (avoid creating duplicates).
  if (dbUser.email) {
    try {
      const candidates = await stripeInstance.customers.list({
        email: dbUser.email,
        limit: 10,
      });

      const desiredId = String(dbUser.id);
      const match = candidates.data.find((c) => {
        if ((c as any)?.deleted) return false;
        const meta = (c as Stripe.Customer).metadata ?? {};
        return meta.id === desiredId || (meta as any).userId === desiredId;
      });

      if (match) {
        await prisma.users.update({
          where: { id: dbUser.id },
          data: { stripe_cusid: match.id },
        });
        await maybeSyncCustomerFields(match.id, match as Stripe.Customer);
        return match.id;
      }
    } catch (e) {
      log.debug('[STRIPE_CUSTOMER] Customer recovery skipped', {
        userId: dbUser.id,
        error: e instanceof Error ? e.message : e,
      });
    }
  }

  const newCustomer = await stripeInstance.customers.create({
    email: dbUser.email,
    name: dbUser.username,
    metadata: {
      id: String(dbUser.id),
      userId: String(dbUser.id),
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
