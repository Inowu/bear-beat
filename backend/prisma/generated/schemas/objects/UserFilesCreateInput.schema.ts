import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.UserFilesCreateInput> = z
  .object({
    product_id: z.string(),
    downloads_left: z.number(),
    order_id: z.number(),
    user_id: z.number(),
    since: z.coerce.date().optional().nullable(),
  })
  .strict();

export const UserFilesCreateInputObjectSchema = Schema;
