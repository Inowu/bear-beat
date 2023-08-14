import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CuponsUsedCountOrderByAggregateInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    user_id: z.lazy(() => SortOrderSchema).optional(),
    cupon_id: z.lazy(() => SortOrderSchema).optional(),
    date_cupon: z.lazy(() => SortOrderSchema).optional(),
  })
  .strict();

export const CuponsUsedCountOrderByAggregateInputObjectSchema = Schema;
