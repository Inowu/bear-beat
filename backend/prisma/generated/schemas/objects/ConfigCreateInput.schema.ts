import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.ConfigCreateInput> = z
  .object({
    name: z.string(),
    value: z.string(),
  })
  .strict();

export const ConfigCreateInputObjectSchema = Schema;
