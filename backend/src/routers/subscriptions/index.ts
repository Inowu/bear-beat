import { router } from '../../trpc';
import { requestSubscriptionCancellation } from './cancel/cancelSubscription';
import { setDefaultStripePm } from './stripe/setDefaultStripeCard';
import { createNewPaymentMethod } from './stripe/createNewPaymentMethod';
import { listStripeCards } from './stripe/listStripeCards';
import { removeStripeCard } from './stripe/removeStripeCard';
import { subscribeWithCardConekta } from './subscribeWithCardConekta';
import { subscribeWithCashConekta } from './subscribeWithCashConekta';
import { subscribeWithPaypal } from './subscribeWithPaypal';
import { subscribeWithStripe } from './subscribeWithStripe';
import { changeSubscriptionPlan } from './changeSubscriptionPlan';

export const subscriptionsRouter = router({
  subscribeWithCardConekta,
  subscribeWithCashConekta,
  subscribeWithStripe,
  subscribeWithPaypal,
  requestSubscriptionCancellation,
  listStripeCards,
  setDefaultStripePm,
  removeStripeCard,
  createNewPaymentMethod,
  changeSubscriptionPlan,
});
