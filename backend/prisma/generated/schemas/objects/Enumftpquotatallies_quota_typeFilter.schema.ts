import { z } from 'zod';
import { ftpquotatallies_quota_typeSchema } from '../enums/ftpquotatallies_quota_type.schema';
import { NestedEnumftpquotatallies_quota_typeFilterObjectSchema } from './NestedEnumftpquotatallies_quota_typeFilter.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.Enumftpquotatallies_quota_typeFilter> = z
  .object({
    equals: z.lazy(() => ftpquotatallies_quota_typeSchema).optional(),
    in: z
      .union([
        z.lazy(() => ftpquotatallies_quota_typeSchema).array(),
        z.lazy(() => ftpquotatallies_quota_typeSchema),
      ])
      .optional(),
    notIn: z
      .union([
        z.lazy(() => ftpquotatallies_quota_typeSchema).array(),
        z.lazy(() => ftpquotatallies_quota_typeSchema),
      ])
      .optional(),
    not: z
      .union([
        z.lazy(() => ftpquotatallies_quota_typeSchema),
        z.lazy(() => NestedEnumftpquotatallies_quota_typeFilterObjectSchema),
      ])
      .optional(),
  })
  .strict();

export const Enumftpquotatallies_quota_typeFilterObjectSchema = Schema;
