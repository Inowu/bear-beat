import { z } from 'zod';
import { ftpquotalimits_quota_typeSchema } from '../enums/ftpquotalimits_quota_type.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.NestedEnumftpquotalimits_quota_typeFilter> = z
  .object({
    equals: z.lazy(() => ftpquotalimits_quota_typeSchema).optional(),
    in: z
      .union([
        z.lazy(() => ftpquotalimits_quota_typeSchema).array(),
        z.lazy(() => ftpquotalimits_quota_typeSchema),
      ])
      .optional(),
    notIn: z
      .union([
        z.lazy(() => ftpquotalimits_quota_typeSchema).array(),
        z.lazy(() => ftpquotalimits_quota_typeSchema),
      ])
      .optional(),
    not: z
      .union([
        z.lazy(() => ftpquotalimits_quota_typeSchema),
        z.lazy(() => NestedEnumftpquotalimits_quota_typeFilterObjectSchema),
      ])
      .optional(),
  })
  .strict();

export const NestedEnumftpquotalimits_quota_typeFilterObjectSchema = Schema;
