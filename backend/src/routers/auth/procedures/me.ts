import { shieldedProcedure } from '../../../procedures/shielded.procedure';

/**
 * Returns the current logged in user
 * */
export const me = shieldedProcedure.query(
  ({ ctx: { session } }) => session?.user,
);
