import { z } from 'zod';
import { UsersCreateWithoutRoleInputObjectSchema } from './UsersCreateWithoutRoleInput.schema';
import { UsersUncheckedCreateWithoutRoleInputObjectSchema } from './UsersUncheckedCreateWithoutRoleInput.schema';
import { UsersCreateOrConnectWithoutRoleInputObjectSchema } from './UsersCreateOrConnectWithoutRoleInput.schema';
import { UsersUpsertWithWhereUniqueWithoutRoleInputObjectSchema } from './UsersUpsertWithWhereUniqueWithoutRoleInput.schema';
import { UsersCreateManyRoleInputEnvelopeObjectSchema } from './UsersCreateManyRoleInputEnvelope.schema';
import { UsersWhereUniqueInputObjectSchema } from './UsersWhereUniqueInput.schema';
import { UsersUpdateWithWhereUniqueWithoutRoleInputObjectSchema } from './UsersUpdateWithWhereUniqueWithoutRoleInput.schema';
import { UsersUpdateManyWithWhereWithoutRoleInputObjectSchema } from './UsersUpdateManyWithWhereWithoutRoleInput.schema';
import { UsersScalarWhereInputObjectSchema } from './UsersScalarWhereInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.UsersUncheckedUpdateManyWithoutRoleNestedInput> =
  z
    .object({
      create: z
        .union([
          z.lazy(() => UsersCreateWithoutRoleInputObjectSchema),
          z.lazy(() => UsersCreateWithoutRoleInputObjectSchema).array(),
          z.lazy(() => UsersUncheckedCreateWithoutRoleInputObjectSchema),
          z
            .lazy(() => UsersUncheckedCreateWithoutRoleInputObjectSchema)
            .array(),
        ])
        .optional(),
      connectOrCreate: z
        .union([
          z.lazy(() => UsersCreateOrConnectWithoutRoleInputObjectSchema),
          z
            .lazy(() => UsersCreateOrConnectWithoutRoleInputObjectSchema)
            .array(),
        ])
        .optional(),
      upsert: z
        .union([
          z.lazy(() => UsersUpsertWithWhereUniqueWithoutRoleInputObjectSchema),
          z
            .lazy(() => UsersUpsertWithWhereUniqueWithoutRoleInputObjectSchema)
            .array(),
        ])
        .optional(),
      createMany: z
        .lazy(() => UsersCreateManyRoleInputEnvelopeObjectSchema)
        .optional(),
      set: z
        .union([
          z.lazy(() => UsersWhereUniqueInputObjectSchema),
          z.lazy(() => UsersWhereUniqueInputObjectSchema).array(),
        ])
        .optional(),
      disconnect: z
        .union([
          z.lazy(() => UsersWhereUniqueInputObjectSchema),
          z.lazy(() => UsersWhereUniqueInputObjectSchema).array(),
        ])
        .optional(),
      delete: z
        .union([
          z.lazy(() => UsersWhereUniqueInputObjectSchema),
          z.lazy(() => UsersWhereUniqueInputObjectSchema).array(),
        ])
        .optional(),
      connect: z
        .union([
          z.lazy(() => UsersWhereUniqueInputObjectSchema),
          z.lazy(() => UsersWhereUniqueInputObjectSchema).array(),
        ])
        .optional(),
      update: z
        .union([
          z.lazy(() => UsersUpdateWithWhereUniqueWithoutRoleInputObjectSchema),
          z
            .lazy(() => UsersUpdateWithWhereUniqueWithoutRoleInputObjectSchema)
            .array(),
        ])
        .optional(),
      updateMany: z
        .union([
          z.lazy(() => UsersUpdateManyWithWhereWithoutRoleInputObjectSchema),
          z
            .lazy(() => UsersUpdateManyWithWhereWithoutRoleInputObjectSchema)
            .array(),
        ])
        .optional(),
      deleteMany: z
        .union([
          z.lazy(() => UsersScalarWhereInputObjectSchema),
          z.lazy(() => UsersScalarWhereInputObjectSchema).array(),
        ])
        .optional(),
    })
    .strict();

export const UsersUncheckedUpdateManyWithoutRoleNestedInputObjectSchema =
  Schema;
