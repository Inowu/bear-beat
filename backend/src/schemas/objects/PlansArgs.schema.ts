import { z } from 'zod';
import { PlansSelectObjectSchema } from './PlansSelect.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.PlansArgs> = z
  .object({
    select: z.lazy(() => PlansSelectObjectSchema).optional(),
  })
  .strict();

export const PlansArgsObjectSchema = Schema;
