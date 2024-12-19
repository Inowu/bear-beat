import Stripe from 'stripe';
import { config } from 'dotenv';

config();

let stripe: Stripe;

const stripeKey = process.env.NODE_ENV === 'production' ? process.env.STRIPE_UH_KEY : process.env.STRIPE_UH_TEST_KEY;

stripe = new Stripe(stripeKey as string, {
  apiVersion: '2023-08-16',
});

const uhStripeInstance = stripe;

export default uhStripeInstance;
