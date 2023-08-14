import { z } from 'zod';
import { CuponsUsedSelectObjectSchema } from './CuponsUsedSelect.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CuponsUsedArgs> = z
  .object({
    select: z.lazy(() => CuponsUsedSelectObjectSchema).optional(),
  })
  .strict();

export const CuponsUsedArgsObjectSchema = Schema;
