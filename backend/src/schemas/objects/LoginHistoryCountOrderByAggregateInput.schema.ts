import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.LoginHistoryCountOrderByAggregateInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    user: z.lazy(() => SortOrderSchema).optional(),
    client_ip: z.lazy(() => SortOrderSchema).optional(),
    server_ip: z.lazy(() => SortOrderSchema).optional(),
    protocol: z.lazy(() => SortOrderSchema).optional(),
    when: z.lazy(() => SortOrderSchema).optional(),
  })
  .strict();

export const LoginHistoryCountOrderByAggregateInputObjectSchema = Schema;
