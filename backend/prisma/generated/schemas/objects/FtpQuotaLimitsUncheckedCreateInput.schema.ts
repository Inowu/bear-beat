import { z } from 'zod';
import { ftpquotalimits_quota_typeSchema } from '../enums/ftpquotalimits_quota_type.schema';
import { ftpquotalimits_per_sessionSchema } from '../enums/ftpquotalimits_per_session.schema';
import { ftpquotalimits_limit_typeSchema } from '../enums/ftpquotalimits_limit_type.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpQuotaLimitsUncheckedCreateInput> = z
  .object({
    id: z.number().optional(),
    name: z.string().optional().nullable(),
    quota_type: z.lazy(() => ftpquotalimits_quota_typeSchema).optional(),
    per_session: z.lazy(() => ftpquotalimits_per_sessionSchema).optional(),
    limit_type: z.lazy(() => ftpquotalimits_limit_typeSchema).optional(),
    bytes_in_avail: z.bigint().optional(),
    bytes_out_avail: z.bigint().optional(),
    bytes_xfer_avail: z.bigint().optional(),
    files_in_avail: z.number().optional(),
    files_out_avail: z.number().optional(),
    files_xfer_avail: z.number().optional(),
  })
  .strict();

export const FtpQuotaLimitsUncheckedCreateInputObjectSchema = Schema;
