import { Plans } from '@prisma/client';
import { PaymentService } from '../routers/subscriptions/services/types';

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
    | PaymentService.PAYPAL
    | PaymentService.STRIPE
    | PaymentService.CONEKTA = PaymentService.CONEKTA,
): ConektaPlanIdKeys<PlansKeys> {
  if (service === PaymentService.CONEKTA) {
    return process.env.NODE_ENV === 'production'
      ? 'conekta_plan_id'
      : 'conekta_plan_id_test';
  }

  if (service === PaymentService.PAYPAL) {
    return process.env.NODE_ENV === 'production'
      ? 'paypal_plan_id'
      : 'paypal_plan_id_test';
  }

  return process.env.NODE_ENV === 'production'
    ? 'stripe_prod_id'
    : 'stripe_prod_id_test';
}
