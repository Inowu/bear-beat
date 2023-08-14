import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CuponsUsedMaxAggregateInputType> = z
  .object({
    id: z.literal(true).optional(),
    user_id: z.literal(true).optional(),
    cupon_id: z.literal(true).optional(),
    date_cupon: z.literal(true).optional(),
  })
  .strict();

export const CuponsUsedMaxAggregateInputObjectSchema = Schema;
