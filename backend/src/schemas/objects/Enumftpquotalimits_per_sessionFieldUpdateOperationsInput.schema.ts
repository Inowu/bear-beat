import { z } from 'zod';
import { ftpquotalimits_per_sessionSchema } from '../enums/ftpquotalimits_per_session.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.Enumftpquotalimits_per_sessionFieldUpdateOperationsInput> =
  z
    .object({
      set: z.lazy(() => ftpquotalimits_per_sessionSchema).optional(),
    })
    .strict();

export const Enumftpquotalimits_per_sessionFieldUpdateOperationsInputObjectSchema =
  Schema;
