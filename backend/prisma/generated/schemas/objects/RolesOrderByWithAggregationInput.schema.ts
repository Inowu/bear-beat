import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { RolesCountOrderByAggregateInputObjectSchema } from './RolesCountOrderByAggregateInput.schema';
import { RolesAvgOrderByAggregateInputObjectSchema } from './RolesAvgOrderByAggregateInput.schema';
import { RolesMaxOrderByAggregateInputObjectSchema } from './RolesMaxOrderByAggregateInput.schema';
import { RolesMinOrderByAggregateInputObjectSchema } from './RolesMinOrderByAggregateInput.schema';
import { RolesSumOrderByAggregateInputObjectSchema } from './RolesSumOrderByAggregateInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.RolesOrderByWithAggregationInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    name: z.lazy(() => SortOrderSchema).optional(),
    _count: z
      .lazy(() => RolesCountOrderByAggregateInputObjectSchema)
      .optional(),
    _avg: z.lazy(() => RolesAvgOrderByAggregateInputObjectSchema).optional(),
    _max: z.lazy(() => RolesMaxOrderByAggregateInputObjectSchema).optional(),
    _min: z.lazy(() => RolesMinOrderByAggregateInputObjectSchema).optional(),
    _sum: z.lazy(() => RolesSumOrderByAggregateInputObjectSchema).optional(),
  })
  .strict();

export const RolesOrderByWithAggregationInputObjectSchema = Schema;
