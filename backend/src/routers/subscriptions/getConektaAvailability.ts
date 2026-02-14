import { shieldedProcedure } from '../../procedures/shielded.procedure';
import { isStripeOxxoConfigured } from '../../stripe/oxxo';

export const getConektaAvailability = shieldedProcedure.query(async () => {
  // Conekta cash + BBVA pay-by-bank are currently hard-disabled in backend procedures.
  // Keep them hidden in the UI until those flows are re-enabled end-to-end.
  const conektaCashEnabled = false;
  const conektaPayByBankEnabled = false;

  // Stripe OXXO (separate account): enabled when STRIPE_OXXO_KEY/STRIPE_OXXO_TEST_KEY are set.
  const stripeOxxoEnabled = isStripeOxxoConfigured();
  return {
    oxxoEnabled: conektaCashEnabled || stripeOxxoEnabled,
    payByBankEnabled: conektaPayByBankEnabled,
  };
});
