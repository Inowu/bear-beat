import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CuponsAvgAggregateInputType> = z
  .object({
    id: z.literal(true).optional(),
    discount: z.literal(true).optional(),
    type: z.literal(true).optional(),
    parameter: z.literal(true).optional(),
    active: z.literal(true).optional(),
  })
  .strict();

export const CuponsAvgAggregateInputObjectSchema = Schema;
