import Stripe from 'stripe';
import { config } from 'dotenv';

config();

let stripe: Stripe;

if (process.env.NODE_ENV === 'production') {
  stripe = new Stripe(process.env.STRIPE_KEY as string, {
    apiVersion: '2022-11-15',
  });
} else {
  stripe = new Stripe(process.env.STRIPE_TEST_KEY as string, {
    apiVersion: '2022-11-15',
  });
}

const stripeInstance = stripe;

export default stripeInstance;
