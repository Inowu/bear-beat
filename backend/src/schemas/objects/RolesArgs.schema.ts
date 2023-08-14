import { z } from 'zod';
import { RolesSelectObjectSchema } from './RolesSelect.schema';
import { RolesIncludeObjectSchema } from './RolesInclude.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.RolesArgs> = z
  .object({
    select: z.lazy(() => RolesSelectObjectSchema).optional(),
    include: z.lazy(() => RolesIncludeObjectSchema).optional(),
  })
  .strict();

export const RolesArgsObjectSchema = Schema;
