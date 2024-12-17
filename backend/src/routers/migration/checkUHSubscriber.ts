import admin from 'firebase-admin'
import path from 'path';
import { publicProcedure } from '../../procedures/public.procedure';
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import stripe from './uhStripe';
import { uhConektaCustomers } from './uhConekta'
import axios from 'axios';
import { paypal } from './uhPaypal';
import { log } from '../../server';
import differenceInDays from 'date-fns/differenceInDays';
import Stripe from 'stripe';

if (!process.env.FIREBASE_ADMIN_CREDENTIALS_PATH) {
  throw new Error('FIREBASE_ADMIN_CREDENTIALS_PATH is not set');
}

// Initialize Firebase
const app = admin.initializeApp({
  credential: admin.credential.cert(path.resolve(__dirname, '../../../', process.env.FIREBASE_ADMIN_CREDENTIALS_PATH as string))
});
const db = admin.firestore(app)

export async function checkIfUserIsSubscriber(user: Record<string, any>): Promise<{ service: 'stripe' | 'conekta' | 'paypal', remainingDays: number, subscriptionEmail: string, subscriptionId: string } | null> {
  if (user.stripe_id) {
    log.info(`[MIGRATION] Checking stripe subscription for user ${user.email}`);

    try {
      const stripeCustomer = await stripe.customers.retrieve(user.stripe_id);

      if (stripeCustomer) {
        const subscriptions = await stripe.subscriptions.list({
          customer: stripeCustomer.id,
          expand: ['data.customer'],
        });

        if (subscriptions.data.length > 0 && subscriptions.data[0].status === 'active') {
          return { service: 'stripe', subscriptionId: subscriptions.data[0].id, remainingDays: differenceInDays(new Date(subscriptions.data[0].current_period_end * 1000), new Date()), subscriptionEmail: (subscriptions.data[0].customer as Stripe.Customer).email! };
        }
      }
    } catch (e: any) {
      if (e.raw.code === 'resource_missing') {
        log.info(`[MIGRATION] Stripe subscription not found: ${user.stripe_id}`);
      } else {
        log.error(`[MIGRATION] An error happened while checking stripe subscription: ${user.stripe_id}: ${e}`);

        return null;
      }
    }
  }

  if (user.conektaId && user.conektaSubId) {
    log.info(`[MIGRATION] Checking conekta subscription for user ${user.email}`);
    try {
      const customer = await uhConektaCustomers.getCustomerById(user.conektaId);
      const subscription = customer.data.subscription;

      if (subscription && subscription.status === 'active' && subscription.billing_cycle_end) {
        return { service: 'conekta', subscriptionId: subscription.id!, remainingDays: differenceInDays(new Date(subscription.billing_cycle_end * 1000), new Date()), subscriptionEmail: customer.data.email! };
      }
    } catch (e: any) {
      if (e.response.status === 404) {
        log.info(`[MIGRATION] Conekta subscription not found: ${user.conektaId}`);
      } else {
        log.error(`[MIGRATION] An error happened while checking conekta subscription: ${user.conektaId}: ${e}`);

        return null;
      }
    }
  }

  if (user.paypalSubscription) {
    log.info(`[MIGRATION] Checking paypal subscription for user ${user.email}`);
    try {
      const subscription = (await axios(`${paypal.paypalUrl()}/v1/billing/subscriptions/${user.paypalSubscription}`, {
        headers: {
          Authorization: `Bearer ${await paypal.getToken()}`,
        },
      })).data;

      if (subscription.status === 'ACTIVE' && subscription.billing_info.next_billing_time) {
        return { service: 'paypal', subscriptionId: subscription.id, remainingDays: differenceInDays(new Date(subscription.billing_info.next_billing_time), new Date()), subscriptionEmail: subscription.subscriber.email_address };
      }
    } catch (e: any) {
      if (e.response.status === 404) {
        log.info(`[MIGRATION] Paypal subscription not found: ${user.paypalSubscription}`);

        return null;
      } else {
        log.error(`[MIGRATION] An error happened while checking paypal subscription: ${user.paypalSubscription}: ${e}`);

        return null;
      }
    }
  }

  log.info(`[MIGRATION] User has no subscription: ${user.email}`);

  return null;
}

export const checkUHSubscriber = publicProcedure
  .input(z.object({
    email: z.string().email(),
  }))
  .query(
    async ({ input: { email }, ctx: { prisma } }) => {
      let uhUser;

      try {
        uhUser = await db.collection('users').where('email', '==', email).get();
      } catch (e) {
        console.error(`Error fetching user ${email} in UH: ${e}`);

        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Un error inesperado ocurrió al verificar el usuario',
        });
      }

      log.info(`[MIGRATION] Checking user ${email} in UH`);

      if (uhUser.empty) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'No hay ningún usuario registrado con este email',
        })
      }

      log.info(`[MIGRATION] User ${email} found in UH`);

      const bearbeatUser = await prisma.users.findUnique({
        where: {
          email: email,
        },
      });

      if (bearbeatUser) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Este email ya está registrado en BearBeat',
        })
      }

      const subscription = await checkIfUserIsSubscriber(uhUser.docs[0].data());

      if (subscription) {
        log.info(`[MIGRATION] User ${email} has subscription: ${subscription.service}`);
      }

      return subscription;
    },
  );
