import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpQuotatAlliesHistorySelect> = z
  .object({
    id: z.boolean().optional(),
    name: z.boolean().optional(),
    quota_type: z.boolean().optional(),
    bytes_in_used: z.boolean().optional(),
    bytes_out_used: z.boolean().optional(),
    bytes_xfer_used: z.boolean().optional(),
    files_in_used: z.boolean().optional(),
    files_out_used: z.boolean().optional(),
    files_xfer_used: z.boolean().optional(),
  })
  .strict();

export const FtpQuotatAlliesHistorySelectObjectSchema = Schema;
