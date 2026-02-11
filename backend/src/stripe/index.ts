import Stripe from 'stripe';
import { config } from 'dotenv';

config();

const hasLiveKey = Boolean(process.env.STRIPE_KEY?.trim());
const hasTestKey = Boolean(process.env.STRIPE_TEST_KEY?.trim());

export const isStripeConfigured = (): boolean => hasLiveKey || hasTestKey;
const DEFAULT_STRIPE_API_VERSION = '2026-01-28.clover';

// Production servers may not set NODE_ENV. Prefer live keys if available and test keys are missing.
const preferLive = process.env.NODE_ENV === 'production' || (hasLiveKey && !hasTestKey);

const apiKey = (preferLive ? process.env.STRIPE_KEY : process.env.STRIPE_TEST_KEY)
  ?? process.env.STRIPE_KEY
  ?? process.env.STRIPE_TEST_KEY
  ?? '';

if (!apiKey) {
  // eslint-disable-next-line no-console
  console.warn('[STRIPE] Missing STRIPE_KEY/STRIPE_TEST_KEY. Stripe API calls will fail.');
}

const stripeApiVersion = process.env.STRIPE_API_VERSION?.trim() || DEFAULT_STRIPE_API_VERSION;

const stripe = new Stripe(apiKey || 'sk_test_missing', {
  apiVersion: stripeApiVersion as Stripe.LatestApiVersion,
  maxNetworkRetries: 2,
});

const stripeInstance = stripe;

export default stripeInstance;
