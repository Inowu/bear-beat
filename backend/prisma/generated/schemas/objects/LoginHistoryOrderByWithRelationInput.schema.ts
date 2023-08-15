import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema } from './SortOrderInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.LoginHistoryOrderByWithRelationInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    user: z.lazy(() => SortOrderSchema).optional(),
    client_ip: z.lazy(() => SortOrderSchema).optional(),
    server_ip: z.lazy(() => SortOrderSchema).optional(),
    protocol: z.lazy(() => SortOrderSchema).optional(),
    when: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
  })
  .strict();

export const LoginHistoryOrderByWithRelationInputObjectSchema = Schema;
