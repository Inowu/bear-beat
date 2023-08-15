import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { FtpQuotatAlliesHistoryCountOrderByAggregateInputObjectSchema } from './FtpQuotatAlliesHistoryCountOrderByAggregateInput.schema';
import { FtpQuotatAlliesHistoryAvgOrderByAggregateInputObjectSchema } from './FtpQuotatAlliesHistoryAvgOrderByAggregateInput.schema';
import { FtpQuotatAlliesHistoryMaxOrderByAggregateInputObjectSchema } from './FtpQuotatAlliesHistoryMaxOrderByAggregateInput.schema';
import { FtpQuotatAlliesHistoryMinOrderByAggregateInputObjectSchema } from './FtpQuotatAlliesHistoryMinOrderByAggregateInput.schema';
import { FtpQuotatAlliesHistorySumOrderByAggregateInputObjectSchema } from './FtpQuotatAlliesHistorySumOrderByAggregateInput.schema';

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
          () => FtpQuotatAlliesHistoryCountOrderByAggregateInputObjectSchema,
        )
        .optional(),
      _avg: z
        .lazy(() => FtpQuotatAlliesHistoryAvgOrderByAggregateInputObjectSchema)
        .optional(),
      _max: z
        .lazy(() => FtpQuotatAlliesHistoryMaxOrderByAggregateInputObjectSchema)
        .optional(),
      _min: z
        .lazy(() => FtpQuotatAlliesHistoryMinOrderByAggregateInputObjectSchema)
        .optional(),
      _sum: z
        .lazy(() => FtpQuotatAlliesHistorySumOrderByAggregateInputObjectSchema)
        .optional(),
    })
    .strict();

export const FtpQuotatAlliesHistoryOrderByWithAggregationInputObjectSchema =
  Schema;
