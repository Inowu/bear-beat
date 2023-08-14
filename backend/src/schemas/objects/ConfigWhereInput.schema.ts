import { z } from 'zod';
import { IntFilterObjectSchema } from './IntFilter.schema';
import { StringFilterObjectSchema } from './StringFilter.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.ConfigWhereInput> = z
  .object({
    AND: z
      .union([
        z.lazy(() => ConfigWhereInputObjectSchema),
        z.lazy(() => ConfigWhereInputObjectSchema).array(),
      ])
      .optional(),
    OR: z
      .lazy(() => ConfigWhereInputObjectSchema)
      .array()
      .optional(),
    NOT: z
      .union([
        z.lazy(() => ConfigWhereInputObjectSchema),
        z.lazy(() => ConfigWhereInputObjectSchema).array(),
      ])
      .optional(),
    id: z.union([z.lazy(() => IntFilterObjectSchema), z.number()]).optional(),
    name: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
    value: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
  })
  .strict();

export const ConfigWhereInputObjectSchema = Schema;
