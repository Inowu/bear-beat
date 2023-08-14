import { z } from 'zod';
import { RolesWhereUniqueInputObjectSchema } from './RolesWhereUniqueInput.schema';
import { RolesCreateWithoutUsersInputObjectSchema } from './RolesCreateWithoutUsersInput.schema';
import { RolesUncheckedCreateWithoutUsersInputObjectSchema } from './RolesUncheckedCreateWithoutUsersInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.RolesCreateOrConnectWithoutUsersInput> = z
  .object({
    where: z.lazy(() => RolesWhereUniqueInputObjectSchema),
    create: z.union([
      z.lazy(() => RolesCreateWithoutUsersInputObjectSchema),
      z.lazy(() => RolesUncheckedCreateWithoutUsersInputObjectSchema),
    ]),
  })
  .strict();

export const RolesCreateOrConnectWithoutUsersInputObjectSchema = Schema;
