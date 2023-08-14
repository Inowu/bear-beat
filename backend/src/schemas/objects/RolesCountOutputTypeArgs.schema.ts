import { z } from 'zod';
import { RolesCountOutputTypeSelectObjectSchema } from './RolesCountOutputTypeSelect.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.RolesCountOutputTypeArgs> = z
  .object({
    select: z.lazy(() => RolesCountOutputTypeSelectObjectSchema).optional(),
  })
  .strict();

export const RolesCountOutputTypeArgsObjectSchema = Schema;
