import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpQuotaTalliesHistoryMaxOrderByAggregateInput> =
  z
    .object({
      id: z.lazy(() => SortOrderSchema).optional(),
      name: z.lazy(() => SortOrderSchema).optional(),
      quota_type: z.lazy(() => SortOrderSchema).optional(),
      bytes_in_used: z.lazy(() => SortOrderSchema).optional(),
      bytes_out_used: z.lazy(() => SortOrderSchema).optional(),
      bytes_xfer_used: z.lazy(() => SortOrderSchema).optional(),
      files_in_used: z.lazy(() => SortOrderSchema).optional(),
      files_out_used: z.lazy(() => SortOrderSchema).optional(),
      files_xfer_used: z.lazy(() => SortOrderSchema).optional(),
    })
    .strict();

export const FtpQuotaTalliesHistoryMaxOrderByAggregateInputObjectSchema =
  Schema;
