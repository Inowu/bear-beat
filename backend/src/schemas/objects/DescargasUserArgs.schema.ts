import { z } from 'zod';
import { DescargasUserSelectObjectSchema } from './DescargasUserSelect.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.DescargasUserArgs> = z
  .object({
    select: z.lazy(() => DescargasUserSelectObjectSchema).optional(),
  })
  .strict();

export const DescargasUserArgsObjectSchema = Schema;
