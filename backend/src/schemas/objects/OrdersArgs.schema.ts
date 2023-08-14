import { z } from 'zod';
import { OrdersSelectObjectSchema } from './OrdersSelect.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.OrdersArgs> = z
  .object({
    select: z.lazy(() => OrdersSelectObjectSchema).optional(),
  })
  .strict();

export const OrdersArgsObjectSchema = Schema;
