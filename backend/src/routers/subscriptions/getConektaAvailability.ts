import { shieldedProcedure } from '../../procedures/shielded.procedure';

export const getConektaAvailability = shieldedProcedure.query(async () => {
  return {
    oxxoEnabled: process.env.CONEKTA_OXXO_ENABLED === '1',
    payByBankEnabled: process.env.CONEKTA_PBB_ENABLED === '1',
  };
});

