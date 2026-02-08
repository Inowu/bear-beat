import { shieldedProcedure } from '../../procedures/shielded.procedure';

export const getConektaAvailability = shieldedProcedure.query(async () => {
  const cashEnabled =
    process.env.CONEKTA_OXXO_ENABLED === '1' || process.env.CONEKTA_CASH_ENABLED === '1';
  const payByBankEnabled =
    process.env.CONEKTA_PBB_ENABLED === '1' || process.env.CONEKTA_PAY_BY_BANK_ENABLED === '1';
  return {
    oxxoEnabled: cashEnabled,
    payByBankEnabled: payByBankEnabled,
  };
});
