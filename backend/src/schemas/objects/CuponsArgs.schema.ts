import { z } from 'zod';
import { CuponsSelectObjectSchema } from './CuponsSelect.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CuponsArgs> = z
  .object({
    select: z.lazy(() => CuponsSelectObjectSchema).optional(),
  })
  .strict();

export const CuponsArgsObjectSchema = Schema;
