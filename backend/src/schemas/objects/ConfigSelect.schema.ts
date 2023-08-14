import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.ConfigSelect> = z
  .object({
    id: z.boolean().optional(),
    name: z.boolean().optional(),
    value: z.boolean().optional(),
  })
  .strict();

export const ConfigSelectObjectSchema = Schema;
