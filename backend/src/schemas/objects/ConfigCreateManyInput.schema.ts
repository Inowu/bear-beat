import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.ConfigCreateManyInput> = z
  .object({
    id: z.number().optional(),
    name: z.string(),
    value: z.string(),
  })
  .strict();

export const ConfigCreateManyInputObjectSchema = Schema;
