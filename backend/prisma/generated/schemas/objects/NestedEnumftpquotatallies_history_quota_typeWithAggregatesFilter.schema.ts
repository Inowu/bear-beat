import { z } from 'zod';
import { ftpquotatallies_history_quota_typeSchema } from '../enums/ftpquotatallies_history_quota_type.schema';
import { NestedIntFilterObjectSchema } from './NestedIntFilter.schema';
import { NestedEnumftpquotatallies_history_quota_typeFilterObjectSchema } from './NestedEnumftpquotatallies_history_quota_typeFilter.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.NestedEnumftpquotatallies_history_quota_typeWithAggregatesFilter> =
  z
    .object({
      equals: z.lazy(() => ftpquotatallies_history_quota_typeSchema).optional(),
      in: z
        .union([
          z.lazy(() => ftpquotatallies_history_quota_typeSchema).array(),
          z.lazy(() => ftpquotatallies_history_quota_typeSchema),
        ])
        .optional(),
      notIn: z
        .union([
          z.lazy(() => ftpquotatallies_history_quota_typeSchema).array(),
          z.lazy(() => ftpquotatallies_history_quota_typeSchema),
        ])
        .optional(),
      not: z
        .union([
          z.lazy(() => ftpquotatallies_history_quota_typeSchema),
          z.lazy(
            () =>
              NestedEnumftpquotatallies_history_quota_typeWithAggregatesFilterObjectSchema,
          ),
        ])
        .optional(),
      _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
      _min: z
        .lazy(
          () => NestedEnumftpquotatallies_history_quota_typeFilterObjectSchema,
        )
        .optional(),
      _max: z
        .lazy(
          () => NestedEnumftpquotatallies_history_quota_typeFilterObjectSchema,
        )
        .optional(),
    })
    .strict();

export const NestedEnumftpquotatallies_history_quota_typeWithAggregatesFilterObjectSchema =
  Schema;
