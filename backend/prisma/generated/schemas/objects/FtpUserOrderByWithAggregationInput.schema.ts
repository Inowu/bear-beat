import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { FtpUserCountOrderByAggregateInputObjectSchema } from './FtpUserCountOrderByAggregateInput.schema';
import { FtpUserAvgOrderByAggregateInputObjectSchema } from './FtpUserAvgOrderByAggregateInput.schema';
import { FtpUserMaxOrderByAggregateInputObjectSchema } from './FtpUserMaxOrderByAggregateInput.schema';
import { FtpUserMinOrderByAggregateInputObjectSchema } from './FtpUserMinOrderByAggregateInput.schema';
import { FtpUserSumOrderByAggregateInputObjectSchema } from './FtpUserSumOrderByAggregateInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpUserOrderByWithAggregationInput> = z
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
    user_id: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    order_id: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    expiration: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    _count: z
      .lazy(() => FtpUserCountOrderByAggregateInputObjectSchema)
      .optional(),
    _avg: z.lazy(() => FtpUserAvgOrderByAggregateInputObjectSchema).optional(),
    _max: z.lazy(() => FtpUserMaxOrderByAggregateInputObjectSchema).optional(),
    _min: z.lazy(() => FtpUserMinOrderByAggregateInputObjectSchema).optional(),
    _sum: z.lazy(() => FtpUserSumOrderByAggregateInputObjectSchema).optional(),
  })
  .strict();

export const FtpUserOrderByWithAggregationInputObjectSchema = Schema;
