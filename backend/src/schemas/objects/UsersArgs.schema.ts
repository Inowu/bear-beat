import { z } from 'zod';
import { UsersSelectObjectSchema } from './UsersSelect.schema';
import { UsersIncludeObjectSchema } from './UsersInclude.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.UsersArgs> = z
  .object({
    select: z.lazy(() => UsersSelectObjectSchema).optional(),
    include: z.lazy(() => UsersIncludeObjectSchema).optional(),
  })
  .strict();

export const UsersArgsObjectSchema = Schema;
