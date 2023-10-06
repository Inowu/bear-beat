import { Plans } from '@prisma/client';
import { SubscriptionService } from '../routers/subscriptions/services/types';

type PlansKeys = keyof Plans;
type ConektaPlanIdKeys<T> = T extends
  | 'conekta_plan_id_test'
  | 'conekta_plan_id'
  | 'stripe_prod_id'
  | 'stripe_prod_id_test'
  | 'paypal_plan_id_test'
  | 'paypal_plan_id'
  ? T
  : never;

export function getPlanKey(
  service:
    | SubscriptionService.PAYPAL
    | SubscriptionService.STRIPE
    | SubscriptionService.CONEKTA = SubscriptionService.CONEKTA,
): ConektaPlanIdKeys<PlansKeys> {
  if (service === SubscriptionService.CONEKTA) {
    return process.env.NODE_ENV === 'production'
      ? 'conekta_plan_id'
      : 'conekta_plan_id_test';
  }

  if (service === SubscriptionService.PAYPAL) {
    return process.env.NODE_ENV === 'production'
      ? 'paypal_plan_id'
      : 'paypal_plan_id_test';
  }

  return process.env.NODE_ENV === 'production'
    ? 'stripe_prod_id'
    : 'stripe_prod_id_test';
}
