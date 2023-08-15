import { z } from 'zod';
import { IntFilterObjectSchema } from './IntFilter.schema';
import { StringFilterObjectSchema } from './StringFilter.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.RolesWhereInput> = z
  .object({
    AND: z
      .union([
        z.lazy(() => RolesWhereInputObjectSchema),
        z.lazy(() => RolesWhereInputObjectSchema).array(),
      ])
      .optional(),
    OR: z
      .lazy(() => RolesWhereInputObjectSchema)
      .array()
      .optional(),
    NOT: z
      .union([
        z.lazy(() => RolesWhereInputObjectSchema),
        z.lazy(() => RolesWhereInputObjectSchema).array(),
      ])
      .optional(),
    id: z.union([z.lazy(() => IntFilterObjectSchema), z.number()]).optional(),
    name: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
  })
  .strict();

export const RolesWhereInputObjectSchema = Schema;
