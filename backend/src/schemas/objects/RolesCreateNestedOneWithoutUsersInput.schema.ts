import { z } from 'zod';
import { RolesCreateWithoutUsersInputObjectSchema } from './RolesCreateWithoutUsersInput.schema';
import { RolesUncheckedCreateWithoutUsersInputObjectSchema } from './RolesUncheckedCreateWithoutUsersInput.schema';
import { RolesCreateOrConnectWithoutUsersInputObjectSchema } from './RolesCreateOrConnectWithoutUsersInput.schema';
import { RolesWhereUniqueInputObjectSchema } from './RolesWhereUniqueInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.RolesCreateNestedOneWithoutUsersInput> = z
  .object({
    create: z
      .union([
        z.lazy(() => RolesCreateWithoutUsersInputObjectSchema),
        z.lazy(() => RolesUncheckedCreateWithoutUsersInputObjectSchema),
      ])
      .optional(),
    connectOrCreate: z
      .lazy(() => RolesCreateOrConnectWithoutUsersInputObjectSchema)
      .optional(),
    connect: z.lazy(() => RolesWhereUniqueInputObjectSchema).optional(),
  })
  .strict();

export const RolesCreateNestedOneWithoutUsersInputObjectSchema = Schema;
