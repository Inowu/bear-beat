import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CuponsUsedSelect> = z
  .object({
    id: z.boolean().optional(),
    user_id: z.boolean().optional(),
    cupon_id: z.boolean().optional(),
    date_cupon: z.boolean().optional(),
  })
  .strict();

export const CuponsUsedSelectObjectSchema = Schema;
