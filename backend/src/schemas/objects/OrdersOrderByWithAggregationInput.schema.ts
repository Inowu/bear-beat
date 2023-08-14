import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { OrdersCountOrderByAggregateInputObjectSchema } from './OrdersCountOrderByAggregateInput.schema';
import { OrdersAvgOrderByAggregateInputObjectSchema } from './OrdersAvgOrderByAggregateInput.schema';
import { OrdersMaxOrderByAggregateInputObjectSchema } from './OrdersMaxOrderByAggregateInput.schema';
import { OrdersMinOrderByAggregateInputObjectSchema } from './OrdersMinOrderByAggregateInput.schema';
import { OrdersSumOrderByAggregateInputObjectSchema } from './OrdersSumOrderByAggregateInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.OrdersOrderByWithAggregationInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    date_order: z.lazy(() => SortOrderSchema).optional(),
    payment_id: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    user_id: z.lazy(() => SortOrderSchema).optional(),
    total_price: z.lazy(() => SortOrderSchema).optional(),
    status: z.lazy(() => SortOrderSchema).optional(),
    discount: z.lazy(() => SortOrderSchema).optional(),
    total_discount: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    cupon_id: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    is_plan: z.lazy(() => SortOrderSchema).optional(),
    plan_id: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    txn_id: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    payment_method: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    invoice_id: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    is_canceled: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    _count: z
      .lazy(() => OrdersCountOrderByAggregateInputObjectSchema)
      .optional(),
    _avg: z.lazy(() => OrdersAvgOrderByAggregateInputObjectSchema).optional(),
    _max: z.lazy(() => OrdersMaxOrderByAggregateInputObjectSchema).optional(),
    _min: z.lazy(() => OrdersMinOrderByAggregateInputObjectSchema).optional(),
    _sum: z.lazy(() => OrdersSumOrderByAggregateInputObjectSchema).optional(),
  })
  .strict();

export const OrdersOrderByWithAggregationInputObjectSchema = Schema;
