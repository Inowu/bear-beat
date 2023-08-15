import { z } from 'zod';
import { ftpquotatallies_quota_typeSchema } from '../enums/ftpquotatallies_quota_type.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.Enumftpquotatallies_quota_typeFieldUpdateOperationsInput> =
  z
    .object({
      set: z.lazy(() => ftpquotatallies_quota_typeSchema).optional(),
    })
    .strict();

export const Enumftpquotatallies_quota_typeFieldUpdateOperationsInputObjectSchema =
  Schema;
