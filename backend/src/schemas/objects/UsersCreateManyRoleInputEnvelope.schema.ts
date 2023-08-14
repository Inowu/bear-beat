import { z } from 'zod';
import { UsersCreateManyRoleInputObjectSchema } from './UsersCreateManyRoleInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.UsersCreateManyRoleInputEnvelope> = z
  .object({
    data: z.union([
      z.lazy(() => UsersCreateManyRoleInputObjectSchema),
      z.lazy(() => UsersCreateManyRoleInputObjectSchema).array(),
    ]),
    skipDuplicates: z.boolean().optional(),
  })
  .strict();

export const UsersCreateManyRoleInputEnvelopeObjectSchema = Schema;
