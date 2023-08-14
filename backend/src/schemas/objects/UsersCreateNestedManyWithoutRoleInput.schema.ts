import { z } from 'zod';
import { UsersCreateWithoutRoleInputObjectSchema } from './UsersCreateWithoutRoleInput.schema';
import { UsersUncheckedCreateWithoutRoleInputObjectSchema } from './UsersUncheckedCreateWithoutRoleInput.schema';
import { UsersCreateOrConnectWithoutRoleInputObjectSchema } from './UsersCreateOrConnectWithoutRoleInput.schema';
import { UsersCreateManyRoleInputEnvelopeObjectSchema } from './UsersCreateManyRoleInputEnvelope.schema';
import { UsersWhereUniqueInputObjectSchema } from './UsersWhereUniqueInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.UsersCreateNestedManyWithoutRoleInput> = z
  .object({
    create: z
      .union([
        z.lazy(() => UsersCreateWithoutRoleInputObjectSchema),
        z.lazy(() => UsersCreateWithoutRoleInputObjectSchema).array(),
        z.lazy(() => UsersUncheckedCreateWithoutRoleInputObjectSchema),
        z.lazy(() => UsersUncheckedCreateWithoutRoleInputObjectSchema).array(),
      ])
      .optional(),
    connectOrCreate: z
      .union([
        z.lazy(() => UsersCreateOrConnectWithoutRoleInputObjectSchema),
        z.lazy(() => UsersCreateOrConnectWithoutRoleInputObjectSchema).array(),
      ])
      .optional(),
    createMany: z
      .lazy(() => UsersCreateManyRoleInputEnvelopeObjectSchema)
      .optional(),
    connect: z
      .union([
        z.lazy(() => UsersWhereUniqueInputObjectSchema),
        z.lazy(() => UsersWhereUniqueInputObjectSchema).array(),
      ])
      .optional(),
  })
  .strict();

export const UsersCreateNestedManyWithoutRoleInputObjectSchema = Schema;
