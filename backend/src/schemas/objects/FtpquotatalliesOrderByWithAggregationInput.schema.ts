import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { FtpquotatalliesCountOrderByAggregateInputObjectSchema } from './FtpquotatalliesCountOrderByAggregateInput.schema';
import { FtpquotatalliesAvgOrderByAggregateInputObjectSchema } from './FtpquotatalliesAvgOrderByAggregateInput.schema';
import { FtpquotatalliesMaxOrderByAggregateInputObjectSchema } from './FtpquotatalliesMaxOrderByAggregateInput.schema';
import { FtpquotatalliesMinOrderByAggregateInputObjectSchema } from './FtpquotatalliesMinOrderByAggregateInput.schema';
import { FtpquotatalliesSumOrderByAggregateInputObjectSchema } from './FtpquotatalliesSumOrderByAggregateInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpquotatalliesOrderByWithAggregationInput> = z
  .object({
    name: z.lazy(() => SortOrderSchema).optional(),
    quota_type: z.lazy(() => SortOrderSchema).optional(),
    bytes_in_used: z.lazy(() => SortOrderSchema).optional(),
    bytes_out_used: z.lazy(() => SortOrderSchema).optional(),
    bytes_xfer_used: z.lazy(() => SortOrderSchema).optional(),
    files_in_used: z.lazy(() => SortOrderSchema).optional(),
    files_out_used: z.lazy(() => SortOrderSchema).optional(),
    files_xfer_used: z.lazy(() => SortOrderSchema).optional(),
    last_renewed_at: z.lazy(() => SortOrderSchema).optional(),
    id: z.lazy(() => SortOrderSchema).optional(),
    _count: z
      .lazy(() => FtpquotatalliesCountOrderByAggregateInputObjectSchema)
      .optional(),
    _avg: z
      .lazy(() => FtpquotatalliesAvgOrderByAggregateInputObjectSchema)
      .optional(),
    _max: z
      .lazy(() => FtpquotatalliesMaxOrderByAggregateInputObjectSchema)
      .optional(),
    _min: z
      .lazy(() => FtpquotatalliesMinOrderByAggregateInputObjectSchema)
      .optional(),
    _sum: z
      .lazy(() => FtpquotatalliesSumOrderByAggregateInputObjectSchema)
      .optional(),
  })
  .strict();

export const FtpquotatalliesOrderByWithAggregationInputObjectSchema = Schema;
