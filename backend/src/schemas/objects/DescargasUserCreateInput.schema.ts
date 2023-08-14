import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.DescargasUserCreateInput> = z
  .object({
    user_id: z.number(),
    order_id: z.number().optional().nullable(),
    available: z.number(),
    ilimitado: z.number().optional(),
    date_end: z.coerce.date(),
  })
  .strict();

export const DescargasUserCreateInputObjectSchema = Schema;
