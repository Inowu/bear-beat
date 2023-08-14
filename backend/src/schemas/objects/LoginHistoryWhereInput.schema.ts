import { z } from 'zod';
import { IntFilterObjectSchema } from './IntFilter.schema';
import { StringFilterObjectSchema } from './StringFilter.schema';
import { StringNullableFilterObjectSchema } from './StringNullableFilter.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.LoginHistoryWhereInput> = z
  .object({
    AND: z
      .union([
        z.lazy(() => LoginHistoryWhereInputObjectSchema),
        z.lazy(() => LoginHistoryWhereInputObjectSchema).array(),
      ])
      .optional(),
    OR: z
      .lazy(() => LoginHistoryWhereInputObjectSchema)
      .array()
      .optional(),
    NOT: z
      .union([
        z.lazy(() => LoginHistoryWhereInputObjectSchema),
        z.lazy(() => LoginHistoryWhereInputObjectSchema).array(),
      ])
      .optional(),
    id: z.union([z.lazy(() => IntFilterObjectSchema), z.number()]).optional(),
    user: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
    client_ip: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
    server_ip: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
    protocol: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
    when: z
      .union([z.lazy(() => StringNullableFilterObjectSchema), z.string()])
      .optional()
      .nullable(),
  })
  .strict();

export const LoginHistoryWhereInputObjectSchema = Schema;
