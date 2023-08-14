import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.UserFilesAvgAggregateInputType> = z
  .object({
    id: z.literal(true).optional(),
    downloads_left: z.literal(true).optional(),
    order_id: z.literal(true).optional(),
    user_id: z.literal(true).optional(),
  })
  .strict();

export const UserFilesAvgAggregateInputObjectSchema = Schema;
