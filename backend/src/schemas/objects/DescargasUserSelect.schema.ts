import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.DescargasUserSelect> = z
  .object({
    id: z.boolean().optional(),
    user_id: z.boolean().optional(),
    order_id: z.boolean().optional(),
    available: z.boolean().optional(),
    ilimitado: z.boolean().optional(),
    date_end: z.boolean().optional(),
  })
  .strict();

export const DescargasUserSelectObjectSchema = Schema;
