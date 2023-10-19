import { router } from '../../trpc';
import { cancelPaypalSubscription } from './cancel/cancelPaypalSubscription';
import { cancelStripeSubscription } from './cancel/cancelStripeSubscription';
import { subscribeWithCardConekta } from './subscribeWithCardConekta';
import { subscribeWithCashConekta } from './subscribeWithCashConekta';
import { subscribeWithPaypal } from './subscribeWithPaypal';
import { subscribeWithStripe } from './subscribeWithStripe';

export const subscriptionsRouter = router({
  subscribeWithCardConekta,
  subscribeWithCashConekta,
  subscribeWithStripe,
  subscribeWithPaypal,
  cancelStripeSubscription,
  cancelPaypalSubscription,
});
