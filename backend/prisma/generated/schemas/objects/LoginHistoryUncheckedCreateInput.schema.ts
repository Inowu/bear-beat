import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.LoginHistoryUncheckedCreateInput> = z
  .object({
    id: z.number().optional(),
    user: z.string(),
    client_ip: z.string(),
    server_ip: z.string(),
    protocol: z.string(),
    when: z.string().optional().nullable(),
  })
  .strict();

export const LoginHistoryUncheckedCreateInputObjectSchema = Schema;
