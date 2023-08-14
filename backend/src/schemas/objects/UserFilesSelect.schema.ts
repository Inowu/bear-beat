import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.UserFilesSelect> = z
  .object({
    id: z.boolean().optional(),
    product_id: z.boolean().optional(),
    downloads_left: z.boolean().optional(),
    order_id: z.boolean().optional(),
    user_id: z.boolean().optional(),
    since: z.boolean().optional(),
  })
  .strict();

export const UserFilesSelectObjectSchema = Schema;
