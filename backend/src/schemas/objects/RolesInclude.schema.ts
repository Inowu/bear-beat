import { z } from 'zod';
import { UsersFindManySchema } from '../findManyUsers.schema';
import { RolesCountOutputTypeArgsObjectSchema } from './RolesCountOutputTypeArgs.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.RolesInclude> = z
  .object({
    users: z.union([z.boolean(), z.lazy(() => UsersFindManySchema)]).optional(),
    _count: z
      .union([z.boolean(), z.lazy(() => RolesCountOutputTypeArgsObjectSchema)])
      .optional(),
  })
  .strict();

export const RolesIncludeObjectSchema = Schema;
