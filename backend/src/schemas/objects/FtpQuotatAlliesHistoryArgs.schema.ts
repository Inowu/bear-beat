import { z } from 'zod';
import { FtpQuotatAlliesHistorySelectObjectSchema } from './FtpQuotatAlliesHistorySelect.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpQuotatAlliesHistoryArgs> = z
  .object({
    select: z.lazy(() => FtpQuotatAlliesHistorySelectObjectSchema).optional(),
  })
  .strict();

export const FtpQuotatAlliesHistoryArgsObjectSchema = Schema;
