import { z } from 'zod';
import { IntFilterObjectSchema } from './IntFilter.schema';
import { StringFilterObjectSchema } from './StringFilter.schema';
import { DateTimeNullableFilterObjectSchema } from './DateTimeNullableFilter.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.UserFilesWhereInput> = z
  .object({
    AND: z
      .union([
        z.lazy(() => UserFilesWhereInputObjectSchema),
        z.lazy(() => UserFilesWhereInputObjectSchema).array(),
      ])
      .optional(),
    OR: z
      .lazy(() => UserFilesWhereInputObjectSchema)
      .array()
      .optional(),
    NOT: z
      .union([
        z.lazy(() => UserFilesWhereInputObjectSchema),
        z.lazy(() => UserFilesWhereInputObjectSchema).array(),
      ])
      .optional(),
    id: z.union([z.lazy(() => IntFilterObjectSchema), z.number()]).optional(),
    product_id: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
    downloads_left: z
      .union([z.lazy(() => IntFilterObjectSchema), z.number()])
      .optional(),
    order_id: z
      .union([z.lazy(() => IntFilterObjectSchema), z.number()])
      .optional(),
    user_id: z
      .union([z.lazy(() => IntFilterObjectSchema), z.number()])
      .optional(),
    since: z
      .union([
        z.lazy(() => DateTimeNullableFilterObjectSchema),
        z.coerce.date(),
      ])
      .optional()
      .nullable(),
  })
  .strict();

export const UserFilesWhereInputObjectSchema = Schema;
