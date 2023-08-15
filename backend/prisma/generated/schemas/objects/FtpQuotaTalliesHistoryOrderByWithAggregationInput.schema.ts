import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { FtpQuotaTalliesHistoryCountOrderByAggregateInputObjectSchema } from './FtpQuotaTalliesHistoryCountOrderByAggregateInput.schema';
import { FtpQuotaTalliesHistoryAvgOrderByAggregateInputObjectSchema } from './FtpQuotaTalliesHistoryAvgOrderByAggregateInput.schema';
import { FtpQuotaTalliesHistoryMaxOrderByAggregateInputObjectSchema } from './FtpQuotaTalliesHistoryMaxOrderByAggregateInput.schema';
import { FtpQuotaTalliesHistoryMinOrderByAggregateInputObjectSchema } from './FtpQuotaTalliesHistoryMinOrderByAggregateInput.schema';
import { FtpQuotaTalliesHistorySumOrderByAggregateInputObjectSchema } from './FtpQuotaTalliesHistorySumOrderByAggregateInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpQuotaTalliesHistoryOrderByWithAggregationInput> =
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
      _count: z
        .lazy(
          () => FtpQuotaTalliesHistoryCountOrderByAggregateInputObjectSchema,
        )
        .optional(),
      _avg: z
        .lazy(() => FtpQuotaTalliesHistoryAvgOrderByAggregateInputObjectSchema)
        .optional(),
      _max: z
        .lazy(() => FtpQuotaTalliesHistoryMaxOrderByAggregateInputObjectSchema)
        .optional(),
      _min: z
        .lazy(() => FtpQuotaTalliesHistoryMinOrderByAggregateInputObjectSchema)
        .optional(),
      _sum: z
        .lazy(() => FtpQuotaTalliesHistorySumOrderByAggregateInputObjectSchema)
        .optional(),
    })
    .strict();

export const FtpQuotaTalliesHistoryOrderByWithAggregationInputObjectSchema =
  Schema;
