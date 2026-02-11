import { shieldedProcedure } from '../../procedures/shielded.procedure';

export const getConektaAvailability = shieldedProcedure.query(async () => {
  const cashEnabled =
    process.env.CONEKTA_OXXO_ENABLED === '1' || process.env.CONEKTA_CASH_ENABLED === '1';
  // Temporary hard-disable for BBVA pay-by-bank until provider flow is stabilized in production.
  const payByBankEnabled = false;
  return {
    oxxoEnabled: cashEnabled,
    payByBankEnabled: payByBankEnabled,
  };
});
