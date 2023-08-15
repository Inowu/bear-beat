import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpQuotaTalliesHistoryMinAggregateInputType> = z
  .object({
    id: z.literal(true).optional(),
    name: z.literal(true).optional(),
    quota_type: z.literal(true).optional(),
    bytes_in_used: z.literal(true).optional(),
    bytes_out_used: z.literal(true).optional(),
    bytes_xfer_used: z.literal(true).optional(),
    files_in_used: z.literal(true).optional(),
    files_out_used: z.literal(true).optional(),
    files_xfer_used: z.literal(true).optional(),
  })
  .strict();

export const FtpQuotatAlliesHistoryMinAggregateInputObjectSchema = Schema;
