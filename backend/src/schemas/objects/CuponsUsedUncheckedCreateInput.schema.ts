import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CuponsUsedUncheckedCreateInput> = z
  .object({
    id: z.number().optional(),
    user_id: z.number(),
    cupon_id: z.number(),
    date_cupon: z.coerce.date(),
  })
  .strict();

export const CuponsUsedUncheckedCreateInputObjectSchema = Schema;
