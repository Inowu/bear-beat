import { z } from 'zod';
import { ftpquotalimits_quota_typeSchema } from '../enums/ftpquotalimits_quota_type.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.Enumftpquotalimits_quota_typeFieldUpdateOperationsInput> =
  z
    .object({
      set: z.lazy(() => ftpquotalimits_quota_typeSchema).optional(),
    })
    .strict();

export const Enumftpquotalimits_quota_typeFieldUpdateOperationsInputObjectSchema =
  Schema;
