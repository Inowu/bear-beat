import { FastifyRequest } from 'fastify';
import stripeInstance from '../../stripe';

export const verifyStripeSignature = (req: FastifyRequest) => {
  const sig = req.headers['stripe-signature'];

  if (!sig) {
    return false;
  }

  try {
    stripeInstance.webhooks.constructEvent(
      req.body as any,
      sig,
      process.env.STRIPE_WH_SECRET as string,
    );

    return true;
  } catch (err) {
    return false;
  }
};
