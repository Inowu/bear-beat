import { router } from '../../trpc';
import { subscribeWithCardConekta } from './subscribeWithCardConekta';
import { subscribeWithCashConekta } from './subscribeWithCashConekta';
import { subscribeWithPaypal } from './subscribeWithPaypal';
import { subscribeWithStripe } from './subscribeWithStripe';

export const subscriptionsRouter = router({
  subscribeWithCardConekta,
  subscribeWithCashConekta,
  subscribeWithStripe,
  subscribeWithPaypal,
});
