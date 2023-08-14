import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpUserUncheckedCreateInput> = z
  .object({
    id: z.number().optional(),
    userid: z.string().optional(),
    passwd: z.string().optional(),
    uid: z.number().optional(),
    gid: z.number().optional(),
    homedir: z.string().optional(),
    shell: z.string().optional(),
    count: z.number().optional(),
    accessed: z.coerce.date().optional(),
    modified: z.coerce.date().optional(),
    user_id: z.number().optional().nullable(),
    order_id: z.number().optional().nullable(),
    expiration: z.coerce.date().optional().nullable(),
  })
  .strict();

export const FtpUserUncheckedCreateInputObjectSchema = Schema;
