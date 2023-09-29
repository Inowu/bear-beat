import { router } from '../../trpc';
import { conektaSubscriptionWebhook } from './conekta';
import { stripeSubscriptionWebhook } from './stripe';

export const webhooksRouter = router({
  // conektaSubscriptionWebhook,
  // stripeSubscriptionWebhook,
});
