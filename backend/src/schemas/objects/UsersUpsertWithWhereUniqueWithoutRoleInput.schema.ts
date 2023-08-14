import { z } from 'zod';
import { UsersWhereUniqueInputObjectSchema } from './UsersWhereUniqueInput.schema';
import { UsersUpdateWithoutRoleInputObjectSchema } from './UsersUpdateWithoutRoleInput.schema';
import { UsersUncheckedUpdateWithoutRoleInputObjectSchema } from './UsersUncheckedUpdateWithoutRoleInput.schema';
import { UsersCreateWithoutRoleInputObjectSchema } from './UsersCreateWithoutRoleInput.schema';
import { UsersUncheckedCreateWithoutRoleInputObjectSchema } from './UsersUncheckedCreateWithoutRoleInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.UsersUpsertWithWhereUniqueWithoutRoleInput> = z
  .object({
    where: z.lazy(() => UsersWhereUniqueInputObjectSchema),
    update: z.union([
      z.lazy(() => UsersUpdateWithoutRoleInputObjectSchema),
      z.lazy(() => UsersUncheckedUpdateWithoutRoleInputObjectSchema),
    ]),
    create: z.union([
      z.lazy(() => UsersCreateWithoutRoleInputObjectSchema),
      z.lazy(() => UsersUncheckedCreateWithoutRoleInputObjectSchema),
    ]),
  })
  .strict();

export const UsersUpsertWithWhereUniqueWithoutRoleInputObjectSchema = Schema;
