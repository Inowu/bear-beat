import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { UserFilesCountOrderByAggregateInputObjectSchema } from './UserFilesCountOrderByAggregateInput.schema';
import { UserFilesAvgOrderByAggregateInputObjectSchema } from './UserFilesAvgOrderByAggregateInput.schema';
import { UserFilesMaxOrderByAggregateInputObjectSchema } from './UserFilesMaxOrderByAggregateInput.schema';
import { UserFilesMinOrderByAggregateInputObjectSchema } from './UserFilesMinOrderByAggregateInput.schema';
import { UserFilesSumOrderByAggregateInputObjectSchema } from './UserFilesSumOrderByAggregateInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.UserFilesOrderByWithAggregationInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    product_id: z.lazy(() => SortOrderSchema).optional(),
    downloads_left: z.lazy(() => SortOrderSchema).optional(),
    order_id: z.lazy(() => SortOrderSchema).optional(),
    user_id: z.lazy(() => SortOrderSchema).optional(),
    since: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    _count: z
      .lazy(() => UserFilesCountOrderByAggregateInputObjectSchema)
      .optional(),
    _avg: z
      .lazy(() => UserFilesAvgOrderByAggregateInputObjectSchema)
      .optional(),
    _max: z
      .lazy(() => UserFilesMaxOrderByAggregateInputObjectSchema)
      .optional(),
    _min: z
      .lazy(() => UserFilesMinOrderByAggregateInputObjectSchema)
      .optional(),
    _sum: z
      .lazy(() => UserFilesSumOrderByAggregateInputObjectSchema)
      .optional(),
  })
  .strict();

export const UserFilesOrderByWithAggregationInputObjectSchema = Schema;
