import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpQuotaLimitsSumOrderByAggregateInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    bytes_in_avail: z.lazy(() => SortOrderSchema).optional(),
    bytes_out_avail: z.lazy(() => SortOrderSchema).optional(),
    bytes_xfer_avail: z.lazy(() => SortOrderSchema).optional(),
    files_in_avail: z.lazy(() => SortOrderSchema).optional(),
    files_out_avail: z.lazy(() => SortOrderSchema).optional(),
    files_xfer_avail: z.lazy(() => SortOrderSchema).optional(),
  })
  .strict();

export const FtpQuotaLimitsSumOrderByAggregateInputObjectSchema = Schema;
