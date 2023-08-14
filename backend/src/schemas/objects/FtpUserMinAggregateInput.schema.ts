import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpUserMinAggregateInputType> = z
  .object({
    id: z.literal(true).optional(),
    userid: z.literal(true).optional(),
    passwd: z.literal(true).optional(),
    uid: z.literal(true).optional(),
    gid: z.literal(true).optional(),
    homedir: z.literal(true).optional(),
    shell: z.literal(true).optional(),
    count: z.literal(true).optional(),
    accessed: z.literal(true).optional(),
    modified: z.literal(true).optional(),
    user_id: z.literal(true).optional(),
    order_id: z.literal(true).optional(),
    expiration: z.literal(true).optional(),
  })
  .strict();

export const FtpUserMinAggregateInputObjectSchema = Schema;
