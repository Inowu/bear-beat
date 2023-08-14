import { z } from 'zod';
import { UsersFindManySchema } from '../findManyUsers.schema';
import { RolesCountOutputTypeArgsObjectSchema } from './RolesCountOutputTypeArgs.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.RolesSelect> = z
  .object({
    id: z.boolean().optional(),
    name: z.boolean().optional(),
    users: z.union([z.boolean(), z.lazy(() => UsersFindManySchema)]).optional(),
    _count: z
      .union([z.boolean(), z.lazy(() => RolesCountOutputTypeArgsObjectSchema)])
      .optional(),
  })
  .strict();

export const RolesSelectObjectSchema = Schema;
