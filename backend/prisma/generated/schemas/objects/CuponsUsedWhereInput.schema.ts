import { z } from 'zod';
import { IntFilterObjectSchema } from './IntFilter.schema';
import { DateTimeFilterObjectSchema } from './DateTimeFilter.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CuponsUsedWhereInput> = z
  .object({
    AND: z
      .union([
        z.lazy(() => CuponsUsedWhereInputObjectSchema),
        z.lazy(() => CuponsUsedWhereInputObjectSchema).array(),
      ])
      .optional(),
    OR: z
      .lazy(() => CuponsUsedWhereInputObjectSchema)
      .array()
      .optional(),
    NOT: z
      .union([
        z.lazy(() => CuponsUsedWhereInputObjectSchema),
        z.lazy(() => CuponsUsedWhereInputObjectSchema).array(),
      ])
      .optional(),
    id: z.union([z.lazy(() => IntFilterObjectSchema), z.number()]).optional(),
    user_id: z
      .union([z.lazy(() => IntFilterObjectSchema), z.number()])
      .optional(),
    cupon_id: z
      .union([z.lazy(() => IntFilterObjectSchema), z.number()])
      .optional(),
    date_cupon: z
      .union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()])
      .optional(),
  })
  .strict();

export const CuponsUsedWhereInputObjectSchema = Schema;
