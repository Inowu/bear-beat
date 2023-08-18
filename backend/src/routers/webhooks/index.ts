import { router } from '../../trpc';
import { conektaSubscriptionWebhook } from './conekta';

export const webhooksRouter = router({
  conektaSubscriptionWebhook,
});
