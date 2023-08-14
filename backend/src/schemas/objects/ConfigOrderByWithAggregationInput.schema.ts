import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { ConfigCountOrderByAggregateInputObjectSchema } from './ConfigCountOrderByAggregateInput.schema';
import { ConfigAvgOrderByAggregateInputObjectSchema } from './ConfigAvgOrderByAggregateInput.schema';
import { ConfigMaxOrderByAggregateInputObjectSchema } from './ConfigMaxOrderByAggregateInput.schema';
import { ConfigMinOrderByAggregateInputObjectSchema } from './ConfigMinOrderByAggregateInput.schema';
import { ConfigSumOrderByAggregateInputObjectSchema } from './ConfigSumOrderByAggregateInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.ConfigOrderByWithAggregationInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    name: z.lazy(() => SortOrderSchema).optional(),
    value: z.lazy(() => SortOrderSchema).optional(),
    _count: z
      .lazy(() => ConfigCountOrderByAggregateInputObjectSchema)
      .optional(),
    _avg: z.lazy(() => ConfigAvgOrderByAggregateInputObjectSchema).optional(),
    _max: z.lazy(() => ConfigMaxOrderByAggregateInputObjectSchema).optional(),
    _min: z.lazy(() => ConfigMinOrderByAggregateInputObjectSchema).optional(),
    _sum: z.lazy(() => ConfigSumOrderByAggregateInputObjectSchema).optional(),
  })
  .strict();

export const ConfigOrderByWithAggregationInputObjectSchema = Schema;
