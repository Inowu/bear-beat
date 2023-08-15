import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { FtpQuotatAlliesHistorySelectObjectSchema } from './FtpQuotatAlliesHistorySelect.schema';

const Schema: z.ZodType<Prisma.FtpQuotaTalliesHistoryArgs> = z
  .object({
    select: z.lazy(() => FtpQuotatAlliesHistorySelectObjectSchema).optional(),
  })
  .strict();

export const FtpQuotatAlliesHistoryArgsObjectSchema = Schema;
