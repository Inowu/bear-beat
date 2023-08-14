import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { CountriesCountOrderByAggregateInputObjectSchema } from './CountriesCountOrderByAggregateInput.schema';
import { CountriesAvgOrderByAggregateInputObjectSchema } from './CountriesAvgOrderByAggregateInput.schema';
import { CountriesMaxOrderByAggregateInputObjectSchema } from './CountriesMaxOrderByAggregateInput.schema';
import { CountriesMinOrderByAggregateInputObjectSchema } from './CountriesMinOrderByAggregateInput.schema';
import { CountriesSumOrderByAggregateInputObjectSchema } from './CountriesSumOrderByAggregateInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CountriesOrderByWithAggregationInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    name: z.lazy(() => SortOrderSchema).optional(),
    code: z.lazy(() => SortOrderSchema).optional(),
    _count: z
      .lazy(() => CountriesCountOrderByAggregateInputObjectSchema)
      .optional(),
    _avg: z
      .lazy(() => CountriesAvgOrderByAggregateInputObjectSchema)
      .optional(),
    _max: z
      .lazy(() => CountriesMaxOrderByAggregateInputObjectSchema)
      .optional(),
    _min: z
      .lazy(() => CountriesMinOrderByAggregateInputObjectSchema)
      .optional(),
    _sum: z
      .lazy(() => CountriesSumOrderByAggregateInputObjectSchema)
      .optional(),
  })
  .strict();

export const CountriesOrderByWithAggregationInputObjectSchema = Schema;
