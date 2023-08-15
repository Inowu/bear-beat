import { z } from 'zod';
import { IntFilterObjectSchema } from './IntFilter.schema';
import { StringFilterObjectSchema } from './StringFilter.schema';
import { StringNullableFilterObjectSchema } from './StringNullableFilter.schema';
import { IntNullableFilterObjectSchema } from './IntNullableFilter.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CuponsWhereInput> = z
  .object({
    AND: z
      .union([
        z.lazy(() => CuponsWhereInputObjectSchema),
        z.lazy(() => CuponsWhereInputObjectSchema).array(),
      ])
      .optional(),
    OR: z
      .lazy(() => CuponsWhereInputObjectSchema)
      .array()
      .optional(),
    NOT: z
      .union([
        z.lazy(() => CuponsWhereInputObjectSchema),
        z.lazy(() => CuponsWhereInputObjectSchema).array(),
      ])
      .optional(),
    id: z.union([z.lazy(() => IntFilterObjectSchema), z.number()]).optional(),
    code: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
    discount: z
      .union([z.lazy(() => IntFilterObjectSchema), z.number()])
      .optional(),
    type: z.union([z.lazy(() => IntFilterObjectSchema), z.number()]).optional(),
    cupon_condition: z
      .union([z.lazy(() => StringNullableFilterObjectSchema), z.string()])
      .optional()
      .nullable(),
    parameter: z
      .union([z.lazy(() => IntNullableFilterObjectSchema), z.number()])
      .optional()
      .nullable(),
    description: z
      .union([z.lazy(() => StringNullableFilterObjectSchema), z.string()])
      .optional()
      .nullable(),
    active: z
      .union([z.lazy(() => IntFilterObjectSchema), z.number()])
      .optional(),
  })
  .strict();

export const CuponsWhereInputObjectSchema = Schema;
