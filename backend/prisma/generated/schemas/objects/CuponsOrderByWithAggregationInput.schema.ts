import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { CuponsCountOrderByAggregateInputObjectSchema } from './CuponsCountOrderByAggregateInput.schema';
import { CuponsAvgOrderByAggregateInputObjectSchema } from './CuponsAvgOrderByAggregateInput.schema';
import { CuponsMaxOrderByAggregateInputObjectSchema } from './CuponsMaxOrderByAggregateInput.schema';
import { CuponsMinOrderByAggregateInputObjectSchema } from './CuponsMinOrderByAggregateInput.schema';
import { CuponsSumOrderByAggregateInputObjectSchema } from './CuponsSumOrderByAggregateInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CuponsOrderByWithAggregationInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    code: z.lazy(() => SortOrderSchema).optional(),
    discount: z.lazy(() => SortOrderSchema).optional(),
    type: z.lazy(() => SortOrderSchema).optional(),
    cupon_condition: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    parameter: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    description: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    active: z.lazy(() => SortOrderSchema).optional(),
    _count: z
      .lazy(() => CuponsCountOrderByAggregateInputObjectSchema)
      .optional(),
    _avg: z.lazy(() => CuponsAvgOrderByAggregateInputObjectSchema).optional(),
    _max: z.lazy(() => CuponsMaxOrderByAggregateInputObjectSchema).optional(),
    _min: z.lazy(() => CuponsMinOrderByAggregateInputObjectSchema).optional(),
    _sum: z.lazy(() => CuponsSumOrderByAggregateInputObjectSchema).optional(),
  })
  .strict();

export const CuponsOrderByWithAggregationInputObjectSchema = Schema;
