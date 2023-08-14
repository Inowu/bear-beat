import { z } from 'zod';
import { UserFilesSelectObjectSchema } from './UserFilesSelect.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.UserFilesArgs> = z
  .object({
    select: z.lazy(() => UserFilesSelectObjectSchema).optional(),
  })
  .strict();

export const UserFilesArgsObjectSchema = Schema;
