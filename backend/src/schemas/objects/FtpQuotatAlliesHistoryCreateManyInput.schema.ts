import { z } from 'zod';
import { ftpquotatallies_history_quota_typeSchema } from '../enums/ftpquotatallies_history_quota_type.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpQuotatAlliesHistoryCreateManyInput> = z
  .object({
    id: z.number().optional(),
    name: z.string(),
    quota_type: z
      .lazy(() => ftpquotatallies_history_quota_typeSchema)
      .optional(),
    bytes_in_used: z.bigint().optional(),
    bytes_out_used: z.bigint().optional(),
    bytes_xfer_used: z.bigint().optional(),
    files_in_used: z.number().optional(),
    files_out_used: z.number().optional(),
    files_xfer_used: z.number().optional(),
  })
  .strict();

export const FtpQuotatAlliesHistoryCreateManyInputObjectSchema = Schema;
