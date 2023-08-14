import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.DescargasUserMinOrderByAggregateInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    user_id: z.lazy(() => SortOrderSchema).optional(),
    order_id: z.lazy(() => SortOrderSchema).optional(),
    available: z.lazy(() => SortOrderSchema).optional(),
    ilimitado: z.lazy(() => SortOrderSchema).optional(),
    date_end: z.lazy(() => SortOrderSchema).optional(),
  })
  .strict();

export const DescargasUserMinOrderByAggregateInputObjectSchema = Schema;
