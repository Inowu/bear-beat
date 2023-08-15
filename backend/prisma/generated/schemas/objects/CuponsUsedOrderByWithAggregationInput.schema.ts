import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { CuponsUsedCountOrderByAggregateInputObjectSchema } from './CuponsUsedCountOrderByAggregateInput.schema';
import { CuponsUsedAvgOrderByAggregateInputObjectSchema } from './CuponsUsedAvgOrderByAggregateInput.schema';
import { CuponsUsedMaxOrderByAggregateInputObjectSchema } from './CuponsUsedMaxOrderByAggregateInput.schema';
import { CuponsUsedMinOrderByAggregateInputObjectSchema } from './CuponsUsedMinOrderByAggregateInput.schema';
import { CuponsUsedSumOrderByAggregateInputObjectSchema } from './CuponsUsedSumOrderByAggregateInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CuponsUsedOrderByWithAggregationInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    user_id: z.lazy(() => SortOrderSchema).optional(),
    cupon_id: z.lazy(() => SortOrderSchema).optional(),
    date_cupon: z.lazy(() => SortOrderSchema).optional(),
    _count: z
      .lazy(() => CuponsUsedCountOrderByAggregateInputObjectSchema)
      .optional(),
    _avg: z
      .lazy(() => CuponsUsedAvgOrderByAggregateInputObjectSchema)
      .optional(),
    _max: z
      .lazy(() => CuponsUsedMaxOrderByAggregateInputObjectSchema)
      .optional(),
    _min: z
      .lazy(() => CuponsUsedMinOrderByAggregateInputObjectSchema)
      .optional(),
    _sum: z
      .lazy(() => CuponsUsedSumOrderByAggregateInputObjectSchema)
      .optional(),
  })
  .strict();

export const CuponsUsedOrderByWithAggregationInputObjectSchema = Schema;
