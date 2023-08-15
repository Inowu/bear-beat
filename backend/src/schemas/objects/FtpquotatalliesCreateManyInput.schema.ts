import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { ftpquotatallies_quota_typeSchema } from '../enums/ftpquotatallies_quota_type.schema';

const Schema: z.ZodType<Prisma.FtpquotatalliesCreateManyInput> = z
  .object({
    name: z.string().optional(),
    quota_type: z.lazy(() => ftpquotatallies_quota_typeSchema).optional(),
    bytes_in_used: z.bigint().optional(),
    bytes_out_used: z.bigint().optional(),
    bytes_xfer_used: z.bigint().optional(),
    files_in_used: z.number().optional(),
    files_out_used: z.number().optional(),
    files_xfer_used: z.number().optional(),
    id: z.number().optional(),
  })
  .strict();

export const FtpquotatalliesCreateManyInputObjectSchema = Schema;
