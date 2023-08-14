import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { FtpQuotaLimitsCountOrderByAggregateInputObjectSchema } from './FtpQuotaLimitsCountOrderByAggregateInput.schema';
import { FtpQuotaLimitsAvgOrderByAggregateInputObjectSchema } from './FtpQuotaLimitsAvgOrderByAggregateInput.schema';
import { FtpQuotaLimitsMaxOrderByAggregateInputObjectSchema } from './FtpQuotaLimitsMaxOrderByAggregateInput.schema';
import { FtpQuotaLimitsMinOrderByAggregateInputObjectSchema } from './FtpQuotaLimitsMinOrderByAggregateInput.schema';
import { FtpQuotaLimitsSumOrderByAggregateInputObjectSchema } from './FtpQuotaLimitsSumOrderByAggregateInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpQuotaLimitsOrderByWithAggregationInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    name: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    quota_type: z.lazy(() => SortOrderSchema).optional(),
    per_session: z.lazy(() => SortOrderSchema).optional(),
    limit_type: z.lazy(() => SortOrderSchema).optional(),
    bytes_in_avail: z.lazy(() => SortOrderSchema).optional(),
    bytes_out_avail: z.lazy(() => SortOrderSchema).optional(),
    bytes_xfer_avail: z.lazy(() => SortOrderSchema).optional(),
    files_in_avail: z.lazy(() => SortOrderSchema).optional(),
    files_out_avail: z.lazy(() => SortOrderSchema).optional(),
    files_xfer_avail: z.lazy(() => SortOrderSchema).optional(),
    _count: z
      .lazy(() => FtpQuotaLimitsCountOrderByAggregateInputObjectSchema)
      .optional(),
    _avg: z
      .lazy(() => FtpQuotaLimitsAvgOrderByAggregateInputObjectSchema)
      .optional(),
    _max: z
      .lazy(() => FtpQuotaLimitsMaxOrderByAggregateInputObjectSchema)
      .optional(),
    _min: z
      .lazy(() => FtpQuotaLimitsMinOrderByAggregateInputObjectSchema)
      .optional(),
    _sum: z
      .lazy(() => FtpQuotaLimitsSumOrderByAggregateInputObjectSchema)
      .optional(),
  })
  .strict();

export const FtpQuotaLimitsOrderByWithAggregationInputObjectSchema = Schema;
