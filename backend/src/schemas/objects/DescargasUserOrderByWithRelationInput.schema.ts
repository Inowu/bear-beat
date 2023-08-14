import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema } from './SortOrderInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.DescargasUserOrderByWithRelationInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    user_id: z.lazy(() => SortOrderSchema).optional(),
    order_id: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    available: z.lazy(() => SortOrderSchema).optional(),
    ilimitado: z.lazy(() => SortOrderSchema).optional(),
    date_end: z.lazy(() => SortOrderSchema).optional(),
  })
  .strict();

export const DescargasUserOrderByWithRelationInputObjectSchema = Schema;
