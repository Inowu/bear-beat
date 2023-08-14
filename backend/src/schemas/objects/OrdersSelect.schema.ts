import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.OrdersSelect> = z
  .object({
    id: z.boolean().optional(),
    date_order: z.boolean().optional(),
    payment_id: z.boolean().optional(),
    user_id: z.boolean().optional(),
    total_price: z.boolean().optional(),
    status: z.boolean().optional(),
    discount: z.boolean().optional(),
    total_discount: z.boolean().optional(),
    cupon_id: z.boolean().optional(),
    is_plan: z.boolean().optional(),
    plan_id: z.boolean().optional(),
    txn_id: z.boolean().optional(),
    payment_method: z.boolean().optional(),
    invoice_id: z.boolean().optional(),
    is_canceled: z.boolean().optional(),
  })
  .strict();

export const OrdersSelectObjectSchema = Schema;
