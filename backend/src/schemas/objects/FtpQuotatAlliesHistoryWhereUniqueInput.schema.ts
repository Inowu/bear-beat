import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpQuotaTalliesHistoryWhereUniqueInput> = z
  .object({
    id: z.number(),
  })
  .strict();

export const FtpQuotatAlliesHistoryWhereUniqueInputObjectSchema = Schema;
