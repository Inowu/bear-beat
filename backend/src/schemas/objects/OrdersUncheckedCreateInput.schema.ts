import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.OrdersUncheckedCreateInput> = z
  .object({
    id: z.number().optional(),
    date_order: z.coerce.date(),
    payment_id: z.number().optional().nullable(),
    user_id: z.number(),
    total_price: z.number(),
    status: z.number().optional(),
    discount: z.number().optional(),
    total_discount: z.number().optional().nullable(),
    cupon_id: z.number().optional().nullable(),
    is_plan: z.number().optional(),
    plan_id: z.number().optional().nullable(),
    txn_id: z.string().optional().nullable(),
    payment_method: z.string().optional().nullable(),
    invoice_id: z.string().optional().nullable(),
    is_canceled: z.number().optional().nullable(),
  })
  .strict();

export const OrdersUncheckedCreateInputObjectSchema = Schema;
