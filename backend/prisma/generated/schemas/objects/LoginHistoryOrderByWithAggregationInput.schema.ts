import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { LoginHistoryCountOrderByAggregateInputObjectSchema } from './LoginHistoryCountOrderByAggregateInput.schema';
import { LoginHistoryAvgOrderByAggregateInputObjectSchema } from './LoginHistoryAvgOrderByAggregateInput.schema';
import { LoginHistoryMaxOrderByAggregateInputObjectSchema } from './LoginHistoryMaxOrderByAggregateInput.schema';
import { LoginHistoryMinOrderByAggregateInputObjectSchema } from './LoginHistoryMinOrderByAggregateInput.schema';
import { LoginHistorySumOrderByAggregateInputObjectSchema } from './LoginHistorySumOrderByAggregateInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.LoginHistoryOrderByWithAggregationInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    user: z.lazy(() => SortOrderSchema).optional(),
    client_ip: z.lazy(() => SortOrderSchema).optional(),
    server_ip: z.lazy(() => SortOrderSchema).optional(),
    protocol: z.lazy(() => SortOrderSchema).optional(),
    when: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    _count: z
      .lazy(() => LoginHistoryCountOrderByAggregateInputObjectSchema)
      .optional(),
    _avg: z
      .lazy(() => LoginHistoryAvgOrderByAggregateInputObjectSchema)
      .optional(),
    _max: z
      .lazy(() => LoginHistoryMaxOrderByAggregateInputObjectSchema)
      .optional(),
    _min: z
      .lazy(() => LoginHistoryMinOrderByAggregateInputObjectSchema)
      .optional(),
    _sum: z
      .lazy(() => LoginHistorySumOrderByAggregateInputObjectSchema)
      .optional(),
  })
  .strict();

export const LoginHistoryOrderByWithAggregationInputObjectSchema = Schema;
