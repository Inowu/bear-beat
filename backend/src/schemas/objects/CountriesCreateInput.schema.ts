import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CountriesCreateInput> = z
  .object({
    name: z.string(),
    code: z.string(),
  })
  .strict();

export const CountriesCreateInputObjectSchema = Schema;
