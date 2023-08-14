import { z } from 'zod';
import { FtpQuotaLimitsSelectObjectSchema } from './FtpQuotaLimitsSelect.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpQuotaLimitsArgs> = z
  .object({
    select: z.lazy(() => FtpQuotaLimitsSelectObjectSchema).optional(),
  })
  .strict();

export const FtpQuotaLimitsArgsObjectSchema = Schema;
