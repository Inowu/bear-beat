import { z } from 'zod';
import { UsersUncheckedCreateNestedManyWithoutRoleInputObjectSchema } from './UsersUncheckedCreateNestedManyWithoutRoleInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.RolesUncheckedCreateInput> = z
  .object({
    id: z.number().optional(),
    name: z.string(),
    users: z
      .lazy(() => UsersUncheckedCreateNestedManyWithoutRoleInputObjectSchema)
      .optional(),
  })
  .strict();

export const RolesUncheckedCreateInputObjectSchema = Schema;
