import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CuponsUsedCreateInput> = z
  .object({
    user_id: z.number(),
    cupon_id: z.number(),
    date_cupon: z.coerce.date(),
  })
  .strict();

export const CuponsUsedCreateInputObjectSchema = Schema;
