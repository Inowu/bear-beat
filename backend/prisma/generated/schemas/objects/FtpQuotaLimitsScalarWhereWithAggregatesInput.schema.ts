import { z } from 'zod';
import { IntWithAggregatesFilterObjectSchema } from './IntWithAggregatesFilter.schema';
import { StringNullableWithAggregatesFilterObjectSchema } from './StringNullableWithAggregatesFilter.schema';
import { Enumftpquotalimits_quota_typeWithAggregatesFilterObjectSchema } from './Enumftpquotalimits_quota_typeWithAggregatesFilter.schema';
import { ftpquotalimits_quota_typeSchema } from '../enums/ftpquotalimits_quota_type.schema';
import { Enumftpquotalimits_per_sessionWithAggregatesFilterObjectSchema } from './Enumftpquotalimits_per_sessionWithAggregatesFilter.schema';
import { ftpquotalimits_per_sessionSchema } from '../enums/ftpquotalimits_per_session.schema';
import { Enumftpquotalimits_limit_typeWithAggregatesFilterObjectSchema } from './Enumftpquotalimits_limit_typeWithAggregatesFilter.schema';
import { ftpquotalimits_limit_typeSchema } from '../enums/ftpquotalimits_limit_type.schema';
import { BigIntWithAggregatesFilterObjectSchema } from './BigIntWithAggregatesFilter.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpQuotaLimitsScalarWhereWithAggregatesInput> = z
  .object({
    AND: z
      .union([
        z.lazy(() => FtpQuotaLimitsScalarWhereWithAggregatesInputObjectSchema),
        z
          .lazy(() => FtpQuotaLimitsScalarWhereWithAggregatesInputObjectSchema)
          .array(),
      ])
      .optional(),
    OR: z
      .lazy(() => FtpQuotaLimitsScalarWhereWithAggregatesInputObjectSchema)
      .array()
      .optional(),
    NOT: z
      .union([
        z.lazy(() => FtpQuotaLimitsScalarWhereWithAggregatesInputObjectSchema),
        z
          .lazy(() => FtpQuotaLimitsScalarWhereWithAggregatesInputObjectSchema)
          .array(),
      ])
      .optional(),
    id: z
      .union([z.lazy(() => IntWithAggregatesFilterObjectSchema), z.number()])
      .optional(),
    name: z
      .union([
        z.lazy(() => StringNullableWithAggregatesFilterObjectSchema),
        z.string(),
      ])
      .optional()
      .nullable(),
    quota_type: z
      .union([
        z.lazy(
          () => Enumftpquotalimits_quota_typeWithAggregatesFilterObjectSchema,
        ),
        z.lazy(() => ftpquotalimits_quota_typeSchema),
      ])
      .optional(),
    per_session: z
      .union([
        z.lazy(
          () => Enumftpquotalimits_per_sessionWithAggregatesFilterObjectSchema,
        ),
        z.lazy(() => ftpquotalimits_per_sessionSchema),
      ])
      .optional(),
    limit_type: z
      .union([
        z.lazy(
          () => Enumftpquotalimits_limit_typeWithAggregatesFilterObjectSchema,
        ),
        z.lazy(() => ftpquotalimits_limit_typeSchema),
      ])
      .optional(),
    bytes_in_avail: z
      .union([z.lazy(() => BigIntWithAggregatesFilterObjectSchema), z.bigint()])
      .optional(),
    bytes_out_avail: z
      .union([z.lazy(() => BigIntWithAggregatesFilterObjectSchema), z.bigint()])
      .optional(),
    bytes_xfer_avail: z
      .union([z.lazy(() => BigIntWithAggregatesFilterObjectSchema), z.bigint()])
      .optional(),
    files_in_avail: z
      .union([z.lazy(() => IntWithAggregatesFilterObjectSchema), z.number()])
      .optional(),
    files_out_avail: z
      .union([z.lazy(() => IntWithAggregatesFilterObjectSchema), z.number()])
      .optional(),
    files_xfer_avail: z
      .union([z.lazy(() => IntWithAggregatesFilterObjectSchema), z.number()])
      .optional(),
  })
  .strict();

export const FtpQuotaLimitsScalarWhereWithAggregatesInputObjectSchema = Schema;
