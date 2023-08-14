import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpQuotaLimitsSelect> = z
  .object({
    id: z.boolean().optional(),
    name: z.boolean().optional(),
    quota_type: z.boolean().optional(),
    per_session: z.boolean().optional(),
    limit_type: z.boolean().optional(),
    bytes_in_avail: z.boolean().optional(),
    bytes_out_avail: z.boolean().optional(),
    bytes_xfer_avail: z.boolean().optional(),
    files_in_avail: z.boolean().optional(),
    files_out_avail: z.boolean().optional(),
    files_xfer_avail: z.boolean().optional(),
  })
  .strict();

export const FtpQuotaLimitsSelectObjectSchema = Schema;
