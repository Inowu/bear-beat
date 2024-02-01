import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import { cancelServicesSubscriptions } from './cancelServicesSubscriptions';

export const requestSubscriptionCancellation = shieldedProcedure.mutation(
  async ({ ctx: { prisma, session } }) =>
    cancelServicesSubscriptions({ prisma, user: session!.user! }),
);
