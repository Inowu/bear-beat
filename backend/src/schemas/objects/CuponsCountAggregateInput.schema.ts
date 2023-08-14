import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CuponsCountAggregateInputType> = z
  .object({
    id: z.literal(true).optional(),
    code: z.literal(true).optional(),
    discount: z.literal(true).optional(),
    type: z.literal(true).optional(),
    cupon_condition: z.literal(true).optional(),
    parameter: z.literal(true).optional(),
    description: z.literal(true).optional(),
    active: z.literal(true).optional(),
    _all: z.literal(true).optional(),
  })
  .strict();

export const CuponsCountAggregateInputObjectSchema = Schema;
