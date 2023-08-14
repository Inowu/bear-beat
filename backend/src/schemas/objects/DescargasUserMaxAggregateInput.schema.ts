import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.DescargasUserMaxAggregateInputType> = z
  .object({
    id: z.literal(true).optional(),
    user_id: z.literal(true).optional(),
    order_id: z.literal(true).optional(),
    available: z.literal(true).optional(),
    ilimitado: z.literal(true).optional(),
    date_end: z.literal(true).optional(),
  })
  .strict();

export const DescargasUserMaxAggregateInputObjectSchema = Schema;
