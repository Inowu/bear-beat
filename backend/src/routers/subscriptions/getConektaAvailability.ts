import { shieldedProcedure } from '../../procedures/shielded.procedure';

export const getConektaAvailability = shieldedProcedure.query(async () => {
  // Temporary hard-disable for cash/OXXO until provider flow is stabilized in production.
  const cashEnabled = false;
  // Temporary hard-disable for BBVA pay-by-bank until provider flow is stabilized in production.
  const payByBankEnabled = false;
  return {
    oxxoEnabled: cashEnabled,
    payByBankEnabled: payByBankEnabled,
  };
});
