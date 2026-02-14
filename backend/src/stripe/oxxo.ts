import Stripe from 'stripe';
import { loadEnvOnce } from '../utils/loadEnv';

loadEnvOnce();

const hasLiveKey = Boolean(process.env.STRIPE_OXXO_KEY?.trim());
const hasTestKey = Boolean(process.env.STRIPE_OXXO_TEST_KEY?.trim());

export const isStripeOxxoConfigured = (): boolean => hasLiveKey || hasTestKey;

const DEFAULT_STRIPE_API_VERSION = '2026-01-28.clover';

// Production servers may not set NODE_ENV. Prefer live keys if available and test keys are missing.
const preferLive = process.env.NODE_ENV === 'production' || (hasLiveKey && !hasTestKey);

const apiKey = (preferLive ? process.env.STRIPE_OXXO_KEY : process.env.STRIPE_OXXO_TEST_KEY)
  ?? process.env.STRIPE_OXXO_KEY
  ?? process.env.STRIPE_OXXO_TEST_KEY
  ?? '';

if (!apiKey) {
  // eslint-disable-next-line no-console
  console.warn('[STRIPE_OXXO] Missing STRIPE_OXXO_KEY/STRIPE_OXXO_TEST_KEY. OXXO Stripe API calls will fail.');
}

const stripeApiVersion =
  process.env.STRIPE_OXXO_API_VERSION?.trim()
  || process.env.STRIPE_API_VERSION?.trim()
  || DEFAULT_STRIPE_API_VERSION;

const stripe = new Stripe(apiKey || 'sk_test_missing', {
  apiVersion: stripeApiVersion as Stripe.LatestApiVersion,
  maxNetworkRetries: 2,
});

const stripeOxxoInstance = stripe;

export default stripeOxxoInstance;

