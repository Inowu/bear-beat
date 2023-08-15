import { z } from 'zod';
import { ftpquotatallies_quota_typeSchema } from '../enums/ftpquotatallies_quota_type.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpquotatalliesCreateInput> = z
  .object({
    name: z.string().optional(),
    quota_type: z.lazy(() => ftpquotatallies_quota_typeSchema).optional(),
    bytes_in_used: z.bigint().optional(),
    bytes_out_used: z.bigint().optional(),
    bytes_xfer_used: z.bigint().optional(),
    files_in_used: z.number().optional(),
    files_out_used: z.number().optional(),
    files_xfer_used: z.number().optional(),
  })
  .strict();

export const FtpquotatalliesCreateInputObjectSchema = Schema;
