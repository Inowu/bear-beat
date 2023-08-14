import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.LoginHistoryCountAggregateInputType> = z
  .object({
    id: z.literal(true).optional(),
    user: z.literal(true).optional(),
    client_ip: z.literal(true).optional(),
    server_ip: z.literal(true).optional(),
    protocol: z.literal(true).optional(),
    when: z.literal(true).optional(),
    _all: z.literal(true).optional(),
  })
  .strict();

export const LoginHistoryCountAggregateInputObjectSchema = Schema;
