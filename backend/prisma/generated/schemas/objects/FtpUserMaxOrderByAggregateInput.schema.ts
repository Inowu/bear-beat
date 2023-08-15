import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpUserMaxOrderByAggregateInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    userid: z.lazy(() => SortOrderSchema).optional(),
    passwd: z.lazy(() => SortOrderSchema).optional(),
    uid: z.lazy(() => SortOrderSchema).optional(),
    gid: z.lazy(() => SortOrderSchema).optional(),
    homedir: z.lazy(() => SortOrderSchema).optional(),
    shell: z.lazy(() => SortOrderSchema).optional(),
    count: z.lazy(() => SortOrderSchema).optional(),
    accessed: z.lazy(() => SortOrderSchema).optional(),
    modified: z.lazy(() => SortOrderSchema).optional(),
    user_id: z.lazy(() => SortOrderSchema).optional(),
    order_id: z.lazy(() => SortOrderSchema).optional(),
    expiration: z.lazy(() => SortOrderSchema).optional(),
  })
  .strict();

export const FtpUserMaxOrderByAggregateInputObjectSchema = Schema;
