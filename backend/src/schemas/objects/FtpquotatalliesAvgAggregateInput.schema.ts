import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpquotatalliesAvgAggregateInputType> = z
  .object({
    bytes_in_used: z.literal(true).optional(),
    bytes_out_used: z.literal(true).optional(),
    bytes_xfer_used: z.literal(true).optional(),
    files_in_used: z.literal(true).optional(),
    files_out_used: z.literal(true).optional(),
    files_xfer_used: z.literal(true).optional(),
    id: z.literal(true).optional(),
  })
  .strict();

export const FtpquotatalliesAvgAggregateInputObjectSchema = Schema;
