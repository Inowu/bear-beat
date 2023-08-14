import { z } from 'zod';
import { UsersWhereUniqueInputObjectSchema } from './UsersWhereUniqueInput.schema';
import { UsersCreateWithoutRoleInputObjectSchema } from './UsersCreateWithoutRoleInput.schema';
import { UsersUncheckedCreateWithoutRoleInputObjectSchema } from './UsersUncheckedCreateWithoutRoleInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.UsersCreateOrConnectWithoutRoleInput> = z
  .object({
    where: z.lazy(() => UsersWhereUniqueInputObjectSchema),
    create: z.union([
      z.lazy(() => UsersCreateWithoutRoleInputObjectSchema),
      z.lazy(() => UsersUncheckedCreateWithoutRoleInputObjectSchema),
    ]),
  })
  .strict();

export const UsersCreateOrConnectWithoutRoleInputObjectSchema = Schema;
