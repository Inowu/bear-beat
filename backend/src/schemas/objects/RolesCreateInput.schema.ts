import { z } from 'zod';
import { UsersCreateNestedManyWithoutRoleInputObjectSchema } from './UsersCreateNestedManyWithoutRoleInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.RolesCreateInput> = z
  .object({
    name: z.string(),
    users: z
      .lazy(() => UsersCreateNestedManyWithoutRoleInputObjectSchema)
      .optional(),
  })
  .strict();

export const RolesCreateInputObjectSchema = Schema;
