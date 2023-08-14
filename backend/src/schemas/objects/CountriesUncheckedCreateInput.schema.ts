import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CountriesUncheckedCreateInput> = z
  .object({
    id: z.number().optional(),
    name: z.string(),
    code: z.string(),
  })
  .strict();

export const CountriesUncheckedCreateInputObjectSchema = Schema;
