import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CountriesMaxAggregateInputType> = z
  .object({
    id: z.literal(true).optional(),
    name: z.literal(true).optional(),
    code: z.literal(true).optional(),
  })
  .strict();

export const CountriesMaxAggregateInputObjectSchema = Schema;
