import { z } from 'zod';
import { IntFilterObjectSchema } from './IntFilter.schema';
import { StringFilterObjectSchema } from './StringFilter.schema';
import { DateTimeFilterObjectSchema } from './DateTimeFilter.schema';
import { IntNullableFilterObjectSchema } from './IntNullableFilter.schema';
import { DateTimeNullableFilterObjectSchema } from './DateTimeNullableFilter.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpUserWhereInput> = z
  .object({
    AND: z
      .union([
        z.lazy(() => FtpUserWhereInputObjectSchema),
        z.lazy(() => FtpUserWhereInputObjectSchema).array(),
      ])
      .optional(),
    OR: z
      .lazy(() => FtpUserWhereInputObjectSchema)
      .array()
      .optional(),
    NOT: z
      .union([
        z.lazy(() => FtpUserWhereInputObjectSchema),
        z.lazy(() => FtpUserWhereInputObjectSchema).array(),
      ])
      .optional(),
    id: z.union([z.lazy(() => IntFilterObjectSchema), z.number()]).optional(),
    userid: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
    passwd: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
    uid: z.union([z.lazy(() => IntFilterObjectSchema), z.number()]).optional(),
    gid: z.union([z.lazy(() => IntFilterObjectSchema), z.number()]).optional(),
    homedir: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
    shell: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
    count: z
      .union([z.lazy(() => IntFilterObjectSchema), z.number()])
      .optional(),
    accessed: z
      .union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()])
      .optional(),
    modified: z
      .union([z.lazy(() => DateTimeFilterObjectSchema), z.coerce.date()])
      .optional(),
    user_id: z
      .union([z.lazy(() => IntNullableFilterObjectSchema), z.number()])
      .optional()
      .nullable(),
    order_id: z
      .union([z.lazy(() => IntNullableFilterObjectSchema), z.number()])
      .optional()
      .nullable(),
    expiration: z
      .union([
        z.lazy(() => DateTimeNullableFilterObjectSchema),
        z.coerce.date(),
      ])
      .optional()
      .nullable(),
  })
  .strict();

export const FtpUserWhereInputObjectSchema = Schema;
