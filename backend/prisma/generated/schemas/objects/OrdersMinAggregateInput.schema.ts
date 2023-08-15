import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.OrdersMinAggregateInputType> = z
  .object({
    id: z.literal(true).optional(),
    date_order: z.literal(true).optional(),
    payment_id: z.literal(true).optional(),
    user_id: z.literal(true).optional(),
    total_price: z.literal(true).optional(),
    status: z.literal(true).optional(),
    discount: z.literal(true).optional(),
    total_discount: z.literal(true).optional(),
    cupon_id: z.literal(true).optional(),
    is_plan: z.literal(true).optional(),
    plan_id: z.literal(true).optional(),
    txn_id: z.literal(true).optional(),
    payment_method: z.literal(true).optional(),
    invoice_id: z.literal(true).optional(),
    is_canceled: z.literal(true).optional(),
  })
  .strict();

export const OrdersMinAggregateInputObjectSchema = Schema;
