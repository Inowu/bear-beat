import { Plans } from '@prisma/client';

type PlansKeys = keyof Plans;
type ConektaPlanIdKeys<T> = T extends 'conekta_plan_id_test' | 'conekta_plan_id'
  ? T
  : never;

export function getPlanConektaKey(): ConektaPlanIdKeys<PlansKeys> {
  return process.env.NODE_ENV === 'production'
    ? 'conekta_plan_id'
    : 'conekta_plan_id_test';
}
