import { z } from 'zod';
import { RolesArgsObjectSchema } from './RolesArgs.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.UsersInclude> = z
  .object({
    role: z
      .union([z.boolean(), z.lazy(() => RolesArgsObjectSchema)])
      .optional(),
  })
  .strict();

export const UsersIncludeObjectSchema = Schema;
