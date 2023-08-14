import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpQuotaLimitsSumAggregateInputType> = z
  .object({
    id: z.literal(true).optional(),
    bytes_in_avail: z.literal(true).optional(),
    bytes_out_avail: z.literal(true).optional(),
    bytes_xfer_avail: z.literal(true).optional(),
    files_in_avail: z.literal(true).optional(),
    files_out_avail: z.literal(true).optional(),
    files_xfer_avail: z.literal(true).optional(),
  })
  .strict();

export const FtpQuotaLimitsSumAggregateInputObjectSchema = Schema;
