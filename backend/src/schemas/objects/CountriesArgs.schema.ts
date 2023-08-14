import { z } from 'zod';
import { CountriesSelectObjectSchema } from './CountriesSelect.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CountriesArgs> = z
  .object({
    select: z.lazy(() => CountriesSelectObjectSchema).optional(),
  })
  .strict();

export const CountriesArgsObjectSchema = Schema;
