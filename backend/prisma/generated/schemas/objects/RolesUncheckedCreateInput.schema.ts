import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.RolesUncheckedCreateInput> = z
  .object({
    id: z.number().optional(),
    name: z.string(),
  })
  .strict();

export const RolesUncheckedCreateInputObjectSchema = Schema;
