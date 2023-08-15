import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { ftpquotatallies_quota_typeSchema } from '../enums/ftpquotatallies_quota_type.schema';
import { NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumftpquotatallies_quota_typeFilterObjectSchema } from './NestedEnumftpquotatallies_quota_typeFilter.schema';

const Schema: z.ZodType<Prisma.NestedEnumftpquotatallies_quota_typeWithAggregatesFilter> =
  z
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
          z.lazy(
            () =>
              NestedEnumftpquotatallies_quota_typeWithAggregatesFilterObjectSchema,
          ),
        ])
        .optional(),
      _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
      _min: z
        .lazy(() => NestedEnumftpquotatallies_quota_typeFilterObjectSchema)
        .optional(),
      _max: z
        .lazy(() => NestedEnumftpquotatallies_quota_typeFilterObjectSchema)
        .optional(),
    })
    .strict();

export const NestedEnumftpquotatallies_quota_typeWithAggregatesFilterObjectSchema =
  Schema;
