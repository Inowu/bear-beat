import { router } from '../../trpc';
import { requestSubscriptionCancellation } from './cancel/cancelSubscription';
import { setDefaultStripePm } from './stripe/setDefaultStripeCard';
import { createNewPaymentMethod } from './stripe/createNewPaymentMethod';
import { createBillingPortalSession } from './stripe/createBillingPortalSession';
import { listStripeCards } from './stripe/listStripeCards';
import { removeStripeCard } from './stripe/removeStripeCard';
import { getConektaAvailability } from './getConektaAvailability';
import { subscribeWithCardConekta } from './subscribeWithCardConekta';
import { subscribeWithCashConekta } from './subscribeWithCashConekta';
import { subscribeWithPayByBankConekta } from './subscribeWithPayByBankConekta';
import { subscribeWithPaypal } from './subscribeWithPaypal';
import { subscribeWithStripe } from './subscribeWithStripe';
import { createStripeCheckoutSession } from './createStripeCheckoutSession';
import { changeSubscriptionPlan } from './changeSubscriptionPlan';
import { subscribeWithOxxoStripe } from './subscribeWithOxxoStripe';

export const subscriptionsRouter = router({
  getConektaAvailability,
  subscribeWithCardConekta,
  subscribeWithCashConekta,
  subscribeWithPayByBankConekta,
  subscribeWithStripe,
  subscribeWithOxxoStripe,
  createStripeCheckoutSession,
  subscribeWithPaypal,
  requestSubscriptionCancellation,
  listStripeCards,
  setDefaultStripePm,
  removeStripeCard,
  createNewPaymentMethod,
  createBillingPortalSession,
  changeSubscriptionPlan,
});
