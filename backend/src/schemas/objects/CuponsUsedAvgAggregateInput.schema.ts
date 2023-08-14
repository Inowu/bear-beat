import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CuponsUsedAvgAggregateInputType> = z
  .object({
    id: z.literal(true).optional(),
    user_id: z.literal(true).optional(),
    cupon_id: z.literal(true).optional(),
  })
  .strict();

export const CuponsUsedAvgAggregateInputObjectSchema = Schema;
