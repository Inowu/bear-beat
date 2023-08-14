import { z } from 'zod';
import { UsersWhereUniqueInputObjectSchema } from './UsersWhereUniqueInput.schema';
import { UsersUpdateWithoutRoleInputObjectSchema } from './UsersUpdateWithoutRoleInput.schema';
import { UsersUncheckedUpdateWithoutRoleInputObjectSchema } from './UsersUncheckedUpdateWithoutRoleInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.UsersUpdateWithWhereUniqueWithoutRoleInput> = z
  .object({
    where: z.lazy(() => UsersWhereUniqueInputObjectSchema),
    data: z.union([
      z.lazy(() => UsersUpdateWithoutRoleInputObjectSchema),
      z.lazy(() => UsersUncheckedUpdateWithoutRoleInputObjectSchema),
    ]),
  })
  .strict();

export const UsersUpdateWithWhereUniqueWithoutRoleInputObjectSchema = Schema;
