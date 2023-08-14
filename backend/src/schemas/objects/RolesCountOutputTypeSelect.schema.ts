import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.RolesCountOutputTypeSelect> = z
  .object({
    users: z.boolean().optional(),
  })
  .strict();

export const RolesCountOutputTypeSelectObjectSchema = Schema;
