import { z } from 'zod';
import { ftpquotalimits_limit_typeSchema } from '../enums/ftpquotalimits_limit_type.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.Enumftpquotalimits_limit_typeFieldUpdateOperationsInput> =
  z
    .object({
      set: z.lazy(() => ftpquotalimits_limit_typeSchema).optional(),
    })
    .strict();

export const Enumftpquotalimits_limit_typeFieldUpdateOperationsInputObjectSchema =
  Schema;
