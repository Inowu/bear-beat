import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CountriesSelect> = z
  .object({
    id: z.boolean().optional(),
    name: z.boolean().optional(),
    code: z.boolean().optional(),
  })
  .strict();

export const CountriesSelectObjectSchema = Schema;
