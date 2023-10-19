import { router } from '../../trpc';
import { requestSubscriptionCancellation } from './cancel/cancelSubscription';
import { subscribeWithCardConekta } from './subscribeWithCardConekta';
import { subscribeWithCashConekta } from './subscribeWithCashConekta';
import { subscribeWithPaypal } from './subscribeWithPaypal';
import { subscribeWithStripe } from './subscribeWithStripe';

export const subscriptionsRouter = router({
  subscribeWithCardConekta,
  subscribeWithCashConekta,
  subscribeWithStripe,
  subscribeWithPaypal,
  requestSubscriptionCancellation,
});
