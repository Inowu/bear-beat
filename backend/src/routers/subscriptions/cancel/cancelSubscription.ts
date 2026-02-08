import { shieldedProcedure } from '../../../procedures/shielded.procedure';
import { cancelServicesSubscriptions } from './cancelServicesSubscriptions';
import { z } from 'zod';

const attributionSchema = z
  .object({
    source: z.string().max(120).optional().nullable(),
    medium: z.string().max(120).optional().nullable(),
    campaign: z.string().max(180).optional().nullable(),
    term: z.string().max(180).optional().nullable(),
    content: z.string().max(180).optional().nullable(),
    fbclid: z.string().max(255).optional().nullable(),
    gclid: z.string().max(255).optional().nullable(),
  })
  .partial()
  .optional()
  .nullable();

const cancellationInputSchema = z.object({
  reasonCode: z.string().min(1).max(60),
  reasonText: z.string().max(500).optional().nullable(),
  attribution: attributionSchema,
});

export const requestSubscriptionCancellation = shieldedProcedure
  .input(cancellationInputSchema)
  .mutation(async ({ ctx: { prisma, session }, input }) =>
    cancelServicesSubscriptions({
      prisma,
      user: session!.user!,
      cancellation: input,
    }),
  );
