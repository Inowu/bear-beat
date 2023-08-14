import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { DescargasUserCountOrderByAggregateInputObjectSchema } from './DescargasUserCountOrderByAggregateInput.schema';
import { DescargasUserAvgOrderByAggregateInputObjectSchema } from './DescargasUserAvgOrderByAggregateInput.schema';
import { DescargasUserMaxOrderByAggregateInputObjectSchema } from './DescargasUserMaxOrderByAggregateInput.schema';
import { DescargasUserMinOrderByAggregateInputObjectSchema } from './DescargasUserMinOrderByAggregateInput.schema';
import { DescargasUserSumOrderByAggregateInputObjectSchema } from './DescargasUserSumOrderByAggregateInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.DescargasUserOrderByWithAggregationInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    user_id: z.lazy(() => SortOrderSchema).optional(),
    order_id: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    available: z.lazy(() => SortOrderSchema).optional(),
    ilimitado: z.lazy(() => SortOrderSchema).optional(),
    date_end: z.lazy(() => SortOrderSchema).optional(),
    _count: z
      .lazy(() => DescargasUserCountOrderByAggregateInputObjectSchema)
      .optional(),
    _avg: z
      .lazy(() => DescargasUserAvgOrderByAggregateInputObjectSchema)
      .optional(),
    _max: z
      .lazy(() => DescargasUserMaxOrderByAggregateInputObjectSchema)
      .optional(),
    _min: z
      .lazy(() => DescargasUserMinOrderByAggregateInputObjectSchema)
      .optional(),
    _sum: z
      .lazy(() => DescargasUserSumOrderByAggregateInputObjectSchema)
      .optional(),
  })
  .strict();

export const DescargasUserOrderByWithAggregationInputObjectSchema = Schema;
