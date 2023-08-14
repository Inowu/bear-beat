import { z } from 'zod';
import { RolesUpdateWithoutUsersInputObjectSchema } from './RolesUpdateWithoutUsersInput.schema';
import { RolesUncheckedUpdateWithoutUsersInputObjectSchema } from './RolesUncheckedUpdateWithoutUsersInput.schema';
import { RolesCreateWithoutUsersInputObjectSchema } from './RolesCreateWithoutUsersInput.schema';
import { RolesUncheckedCreateWithoutUsersInputObjectSchema } from './RolesUncheckedCreateWithoutUsersInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.RolesUpsertWithoutUsersInput> = z
  .object({
    update: z.union([
      z.lazy(() => RolesUpdateWithoutUsersInputObjectSchema),
      z.lazy(() => RolesUncheckedUpdateWithoutUsersInputObjectSchema),
    ]),
    create: z.union([
      z.lazy(() => RolesCreateWithoutUsersInputObjectSchema),
      z.lazy(() => RolesUncheckedCreateWithoutUsersInputObjectSchema),
    ]),
  })
  .strict();

export const RolesUpsertWithoutUsersInputObjectSchema = Schema;
