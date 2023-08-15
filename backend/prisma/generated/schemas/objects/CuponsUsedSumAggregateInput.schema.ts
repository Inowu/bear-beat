import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CuponsUsedSumAggregateInputType> = z
  .object({
    id: z.literal(true).optional(),
    user_id: z.literal(true).optional(),
    cupon_id: z.literal(true).optional(),
  })
  .strict();

export const CuponsUsedSumAggregateInputObjectSchema = Schema;
