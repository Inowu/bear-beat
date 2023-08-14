import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.UsersAvgAggregateInputType> = z
  .object({
    id: z.literal(true).optional(),
    role_id: z.literal(true).optional(),
    active: z.literal(true).optional(),
    mc_id: z.literal(true).optional(),
  })
  .strict();

export const UsersAvgAggregateInputObjectSchema = Schema;
