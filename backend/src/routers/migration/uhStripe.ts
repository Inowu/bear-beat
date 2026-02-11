import Stripe from 'stripe';
import { config } from 'dotenv';

config();

let stripe: Stripe;

const stripeKey = process.env.NODE_ENV === 'production' ? process.env.STRIPE_UH_KEY : process.env.STRIPE_UH_TEST_KEY;
const DEFAULT_STRIPE_API_VERSION = '2026-01-28.clover';
const stripeApiVersion =
  process.env.STRIPE_UH_API_VERSION?.trim()
  || process.env.STRIPE_API_VERSION?.trim()
  || DEFAULT_STRIPE_API_VERSION;

if (!stripeKey) {
  // eslint-disable-next-line no-console
  console.warn('[UH_STRIPE] Missing STRIPE_UH_KEY/STRIPE_UH_TEST_KEY. UH migration Stripe calls will fail.');
}

stripe = new Stripe((stripeKey || 'sk_test_missing') as string, {
  apiVersion: stripeApiVersion as Stripe.LatestApiVersion,
  maxNetworkRetries: 2,
});

const uhStripeInstance = stripe;

export default uhStripeInstance;
