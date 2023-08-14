import { z } from 'zod';
import { UsersScalarWhereInputObjectSchema } from './UsersScalarWhereInput.schema';
import { UsersUpdateManyMutationInputObjectSchema } from './UsersUpdateManyMutationInput.schema';
import { UsersUncheckedUpdateManyWithoutUsersInputObjectSchema } from './UsersUncheckedUpdateManyWithoutUsersInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.UsersUpdateManyWithWhereWithoutRoleInput> = z
  .object({
    where: z.lazy(() => UsersScalarWhereInputObjectSchema),
    data: z.union([
      z.lazy(() => UsersUpdateManyMutationInputObjectSchema),
      z.lazy(() => UsersUncheckedUpdateManyWithoutUsersInputObjectSchema),
    ]),
  })
  .strict();

export const UsersUpdateManyWithWhereWithoutRoleInputObjectSchema = Schema;
