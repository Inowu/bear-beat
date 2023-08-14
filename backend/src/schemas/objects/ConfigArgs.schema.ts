import { z } from 'zod';
import { ConfigSelectObjectSchema } from './ConfigSelect.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.ConfigArgs> = z
  .object({
    select: z.lazy(() => ConfigSelectObjectSchema).optional(),
  })
  .strict();

export const ConfigArgsObjectSchema = Schema;
