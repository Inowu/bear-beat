import Stripe from 'stripe';
import { config } from 'dotenv';

config();

const hasLiveKey = Boolean(process.env.STRIPE_KEY?.trim());
const hasTestKey = Boolean(process.env.STRIPE_TEST_KEY?.trim());

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

const stripe = new Stripe(apiKey || 'sk_test_missing', {
  apiVersion: '2023-08-16',
});

const stripeInstance = stripe;

export default stripeInstance;
