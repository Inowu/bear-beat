import { z } from 'zod';
import { IntFilterObjectSchema } from './IntFilter.schema';
import { StringFilterObjectSchema } from './StringFilter.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CountriesWhereInput> = z
  .object({
    AND: z
      .union([
        z.lazy(() => CountriesWhereInputObjectSchema),
        z.lazy(() => CountriesWhereInputObjectSchema).array(),
      ])
      .optional(),
    OR: z
      .lazy(() => CountriesWhereInputObjectSchema)
      .array()
      .optional(),
    NOT: z
      .union([
        z.lazy(() => CountriesWhereInputObjectSchema),
        z.lazy(() => CountriesWhereInputObjectSchema).array(),
      ])
      .optional(),
    id: z.union([z.lazy(() => IntFilterObjectSchema), z.number()]).optional(),
    name: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
    code: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
  })
  .strict();

export const CountriesWhereInputObjectSchema = Schema;
