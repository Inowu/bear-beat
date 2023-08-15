import { z } from 'zod';
import { ftpquotalimits_per_sessionSchema } from '../enums/ftpquotalimits_per_session.schema';
import { NestedEnumftpquotalimits_per_sessionFilterObjectSchema } from './NestedEnumftpquotalimits_per_sessionFilter.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.Enumftpquotalimits_per_sessionFilter> = z
  .object({
    equals: z.lazy(() => ftpquotalimits_per_sessionSchema).optional(),
    in: z
      .union([
        z.lazy(() => ftpquotalimits_per_sessionSchema).array(),
        z.lazy(() => ftpquotalimits_per_sessionSchema),
      ])
      .optional(),
    notIn: z
      .union([
        z.lazy(() => ftpquotalimits_per_sessionSchema).array(),
        z.lazy(() => ftpquotalimits_per_sessionSchema),
      ])
      .optional(),
    not: z
      .union([
        z.lazy(() => ftpquotalimits_per_sessionSchema),
        z.lazy(() => NestedEnumftpquotalimits_per_sessionFilterObjectSchema),
      ])
      .optional(),
  })
  .strict();

export const Enumftpquotalimits_per_sessionFilterObjectSchema = Schema;
