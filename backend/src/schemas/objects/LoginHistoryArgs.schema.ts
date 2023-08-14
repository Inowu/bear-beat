import { z } from 'zod';
import { LoginHistorySelectObjectSchema } from './LoginHistorySelect.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.LoginHistoryArgs> = z
  .object({
    select: z.lazy(() => LoginHistorySelectObjectSchema).optional(),
  })
  .strict();

export const LoginHistoryArgsObjectSchema = Schema;
