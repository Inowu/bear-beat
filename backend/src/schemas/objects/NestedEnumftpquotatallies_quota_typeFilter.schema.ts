import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { ftpquotatallies_quota_typeSchema } from '../enums/ftpquotatallies_quota_type.schema';

const Schema: z.ZodType<Prisma.NestedEnumftpquotatallies_quota_typeFilter> = z
  .object({
    equals: z.lazy(() => ftpquotatallies_quota_typeSchema).optional(),
    in: z
      .lazy(() => ftpquotatallies_quota_typeSchema)
      .array()
      .optional(),
    notIn: z
      .lazy(() => ftpquotatallies_quota_typeSchema)
      .array()
      .optional(),
    not: z
      .union([
        z.lazy(() => ftpquotatallies_quota_typeSchema),
        z.lazy(() => NestedEnumftpquotatallies_quota_typeFilterObjectSchema),
      ])
      .optional(),
  })
  .strict();

export const NestedEnumftpquotatallies_quota_typeFilterObjectSchema = Schema;
