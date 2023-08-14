import { z } from 'zod';
import { UsersWhereInputObjectSchema } from './UsersWhereInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.UsersListRelationFilter> = z
  .object({
    every: z.lazy(() => UsersWhereInputObjectSchema).optional(),
    some: z.lazy(() => UsersWhereInputObjectSchema).optional(),
    none: z.lazy(() => UsersWhereInputObjectSchema).optional(),
  })
  .strict();

export const UsersListRelationFilterObjectSchema = Schema;
