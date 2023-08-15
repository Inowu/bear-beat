import { z } from 'zod';
import { IntFilterObjectSchema } from './IntFilter.schema';
import { StringNullableFilterObjectSchema } from './StringNullableFilter.schema';
import { Enumftpquotalimits_quota_typeFilterObjectSchema } from './Enumftpquotalimits_quota_typeFilter.schema';
import { ftpquotalimits_quota_typeSchema } from '../enums/ftpquotalimits_quota_type.schema';
import { Enumftpquotalimits_per_sessionFilterObjectSchema } from './Enumftpquotalimits_per_sessionFilter.schema';
import { ftpquotalimits_per_sessionSchema } from '../enums/ftpquotalimits_per_session.schema';
import { Enumftpquotalimits_limit_typeFilterObjectSchema } from './Enumftpquotalimits_limit_typeFilter.schema';
import { ftpquotalimits_limit_typeSchema } from '../enums/ftpquotalimits_limit_type.schema';
import { BigIntFilterObjectSchema } from './BigIntFilter.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpQuotaLimitsWhereInput> = z
  .object({
    AND: z
      .union([
        z.lazy(() => FtpQuotaLimitsWhereInputObjectSchema),
        z.lazy(() => FtpQuotaLimitsWhereInputObjectSchema).array(),
      ])
      .optional(),
    OR: z
      .lazy(() => FtpQuotaLimitsWhereInputObjectSchema)
      .array()
      .optional(),
    NOT: z
      .union([
        z.lazy(() => FtpQuotaLimitsWhereInputObjectSchema),
        z.lazy(() => FtpQuotaLimitsWhereInputObjectSchema).array(),
      ])
      .optional(),
    id: z.union([z.lazy(() => IntFilterObjectSchema), z.number()]).optional(),
    name: z
      .union([z.lazy(() => StringNullableFilterObjectSchema), z.string()])
      .optional()
      .nullable(),
    quota_type: z
      .union([
        z.lazy(() => Enumftpquotalimits_quota_typeFilterObjectSchema),
        z.lazy(() => ftpquotalimits_quota_typeSchema),
      ])
      .optional(),
    per_session: z
      .union([
        z.lazy(() => Enumftpquotalimits_per_sessionFilterObjectSchema),
        z.lazy(() => ftpquotalimits_per_sessionSchema),
      ])
      .optional(),
    limit_type: z
      .union([
        z.lazy(() => Enumftpquotalimits_limit_typeFilterObjectSchema),
        z.lazy(() => ftpquotalimits_limit_typeSchema),
      ])
      .optional(),
    bytes_in_avail: z
      .union([z.lazy(() => BigIntFilterObjectSchema), z.bigint()])
      .optional(),
    bytes_out_avail: z
      .union([z.lazy(() => BigIntFilterObjectSchema), z.bigint()])
      .optional(),
    bytes_xfer_avail: z
      .union([z.lazy(() => BigIntFilterObjectSchema), z.bigint()])
      .optional(),
    files_in_avail: z
      .union([z.lazy(() => IntFilterObjectSchema), z.number()])
      .optional(),
    files_out_avail: z
      .union([z.lazy(() => IntFilterObjectSchema), z.number()])
      .optional(),
    files_xfer_avail: z
      .union([z.lazy(() => IntFilterObjectSchema), z.number()])
      .optional(),
  })
  .strict();

export const FtpQuotaLimitsWhereInputObjectSchema = Schema;
