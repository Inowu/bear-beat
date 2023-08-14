import { z } from 'zod';
import { FtpUserSelectObjectSchema } from './FtpUserSelect.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpUserArgs> = z
  .object({
    select: z.lazy(() => FtpUserSelectObjectSchema).optional(),
  })
  .strict();

export const FtpUserArgsObjectSchema = Schema;
