import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpUserSelect> = z
  .object({
    id: z.boolean().optional(),
    userid: z.boolean().optional(),
    passwd: z.boolean().optional(),
    uid: z.boolean().optional(),
    gid: z.boolean().optional(),
    homedir: z.boolean().optional(),
    shell: z.boolean().optional(),
    count: z.boolean().optional(),
    accessed: z.boolean().optional(),
    modified: z.boolean().optional(),
    user_id: z.boolean().optional(),
    order_id: z.boolean().optional(),
    expiration: z.boolean().optional(),
  })
  .strict();

export const FtpUserSelectObjectSchema = Schema;
