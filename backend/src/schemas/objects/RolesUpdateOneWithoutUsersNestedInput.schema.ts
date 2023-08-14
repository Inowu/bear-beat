import { z } from 'zod';
import { RolesCreateWithoutUsersInputObjectSchema } from './RolesCreateWithoutUsersInput.schema';
import { RolesUncheckedCreateWithoutUsersInputObjectSchema } from './RolesUncheckedCreateWithoutUsersInput.schema';
import { RolesCreateOrConnectWithoutUsersInputObjectSchema } from './RolesCreateOrConnectWithoutUsersInput.schema';
import { RolesUpsertWithoutUsersInputObjectSchema } from './RolesUpsertWithoutUsersInput.schema';
import { RolesWhereUniqueInputObjectSchema } from './RolesWhereUniqueInput.schema';
import { RolesUpdateWithoutUsersInputObjectSchema } from './RolesUpdateWithoutUsersInput.schema';
import { RolesUncheckedUpdateWithoutUsersInputObjectSchema } from './RolesUncheckedUpdateWithoutUsersInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.RolesUpdateOneWithoutUsersNestedInput> = z
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
    upsert: z.lazy(() => RolesUpsertWithoutUsersInputObjectSchema).optional(),
    disconnect: z.boolean().optional(),
    delete: z.boolean().optional(),
    connect: z.lazy(() => RolesWhereUniqueInputObjectSchema).optional(),
    update: z
      .union([
        z.lazy(() => RolesUpdateWithoutUsersInputObjectSchema),
        z.lazy(() => RolesUncheckedUpdateWithoutUsersInputObjectSchema),
      ])
      .optional(),
  })
  .strict();

export const RolesUpdateOneWithoutUsersNestedInputObjectSchema = Schema;
