import { Plans } from '@prisma/client';

type PlansKeys = keyof Plans;
type ConektaPlanIdKeys<T> = T extends
  | 'conekta_plan_id_test'
  | 'conekta_plan_id'
  | 'stripe_prod_id'
  | 'stripe_prod_id_test'
  ? T
  : never;

export function getPlanKey(
  service: 'conekta' | 'stripe' = 'conekta',
): ConektaPlanIdKeys<PlansKeys> {
  if (service === 'conekta') {
    return process.env.NODE_ENV === 'production'
      ? 'conekta_plan_id'
      : 'conekta_plan_id_test';
  }

  return process.env.NODE_ENV === 'production'
    ? 'stripe_prod_id'
    : 'stripe_prod_id_test';
}
