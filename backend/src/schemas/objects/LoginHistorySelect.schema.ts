import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.LoginHistorySelect> = z
  .object({
    id: z.boolean().optional(),
    user: z.boolean().optional(),
    client_ip: z.boolean().optional(),
    server_ip: z.boolean().optional(),
    protocol: z.boolean().optional(),
    when: z.boolean().optional(),
  })
  .strict();

export const LoginHistorySelectObjectSchema = Schema;
