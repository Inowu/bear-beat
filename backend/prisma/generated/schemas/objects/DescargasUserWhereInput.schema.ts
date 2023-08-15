import { z } from 'zod';
import { IntFilterObjectSchema } from './IntFilter.schema';
import { IntNullableFilterObjectSchema } from './IntNullableFilter.schema';
import { FloatFilterObjectSchema } from './FloatFilter.schema';
import { DateTimeFilterObjectSchema } from './DateTimeFilter.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.DescargasUserWhereInput> = z
  .object({
    AND: z
      .union([
        z.lazy(() => DescargasUserWhereInputObjectSchema),
        z.lazy(() => DescargasUserWhereInputObjectSchema).array(),
      ])
      .optional(),
    OR: z
      .lazy(() => DescargasUserWhereInputObjectSchema)
      .array()
      .optional(),
    NOT: z
      .union([
        z.lazy(() => DescargasUserWhereInputObjectSchema),
        z.lazy(() => DescargasUserWhereInputObjectSchema).array(),
      ])
      .optional(),
    id: z.union([z.lazy(() => IntFilterObjectSchema), z.number()]).optional(),
    user_id: z
      .union([z.lazy(() => IntFilterObjectSchema), z.number()])
      .optional(),
    order_id: z
      .union([z.lazy(() => IntNullableFilterObjectSchema), z.number()])
      .optional()
      .nullable(),
    available: z
      .union([z.lazy(() => FloatFilterObjectSchema), z.number()])
      .optional(),
    ilimitado: z
      .union([z.lazy(() => IntFilterObjectSchema), z.number()])
      .optional(),
    date_end: z
      .union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()])
      .optional(),
  })
  .strict();

export const DescargasUserWhereInputObjectSchema = Schema;
