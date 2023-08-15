import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.OrdersMaxOrderByAggregateInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    date_order: z.lazy(() => SortOrderSchema).optional(),
    payment_id: z.lazy(() => SortOrderSchema).optional(),
    user_id: z.lazy(() => SortOrderSchema).optional(),
    total_price: z.lazy(() => SortOrderSchema).optional(),
    status: z.lazy(() => SortOrderSchema).optional(),
    discount: z.lazy(() => SortOrderSchema).optional(),
    total_discount: z.lazy(() => SortOrderSchema).optional(),
    cupon_id: z.lazy(() => SortOrderSchema).optional(),
    is_plan: z.lazy(() => SortOrderSchema).optional(),
    plan_id: z.lazy(() => SortOrderSchema).optional(),
    txn_id: z.lazy(() => SortOrderSchema).optional(),
    payment_method: z.lazy(() => SortOrderSchema).optional(),
    invoice_id: z.lazy(() => SortOrderSchema).optional(),
    is_canceled: z.lazy(() => SortOrderSchema).optional(),
  })
  .strict();

export const OrdersMaxOrderByAggregateInputObjectSchema = Schema;
