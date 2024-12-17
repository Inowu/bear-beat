import Stripe from 'stripe';
import { config } from 'dotenv';

config();

let stripe: Stripe;

stripe = new Stripe(process.env.STRIPE_UH_KEY as string, {
  apiVersion: '2023-08-16',
});

const uhStripeInstance = stripe;

export default uhStripeInstance;
