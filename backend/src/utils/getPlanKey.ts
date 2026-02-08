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
  const isProd = process.env.NODE_ENV === 'production';

  if (service === PaymentService.CONEKTA) {
    const hasLive = Boolean(process.env.CONEKTA_KEY?.trim());
    const hasTest = Boolean(process.env.CONEKTA_TEST_KEY?.trim());
    const useLive = isProd || (hasLive && !hasTest);
    return useLive ? 'conekta_plan_id' : 'conekta_plan_id_test';
  }

  if (service === PaymentService.PAYPAL) {
    const hasLive = Boolean(
      process.env.PAYPAL_CLIENT_ID?.trim() &&
        process.env.PAYPAL_CLIENT_SECRET?.trim(),
    );
    const hasTest = Boolean(
      process.env.PAYPAL_TEST_CLIENT_ID?.trim() &&
        process.env.PAYPAL_TEST_CLIENT_SECRET?.trim(),
    );
    const useLive = isProd || (hasLive && !hasTest);
    return useLive ? 'paypal_plan_id' : 'paypal_plan_id_test';
  }

  const hasLive = Boolean(process.env.STRIPE_KEY?.trim());
  const hasTest = Boolean(process.env.STRIPE_TEST_KEY?.trim());
  const useLive = isProd || (hasLive && !hasTest);
  return useLive ? 'stripe_prod_id' : 'stripe_prod_id_test';
}
