import { z } from 'zod';
import { StringFilterObjectSchema } from './StringFilter.schema';
import { Enumftpquotatallies_quota_typeFilterObjectSchema } from './Enumftpquotatallies_quota_typeFilter.schema';
import { ftpquotatallies_quota_typeSchema } from '../enums/ftpquotatallies_quota_type.schema';
import { BigIntFilterObjectSchema } from './BigIntFilter.schema';
import { IntFilterObjectSchema } from './IntFilter.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpquotatalliesWhereInput> = z
  .object({
    AND: z
      .union([
        z.lazy(() => FtpquotatalliesWhereInputObjectSchema),
        z.lazy(() => FtpquotatalliesWhereInputObjectSchema).array(),
      ])
      .optional(),
    OR: z
      .lazy(() => FtpquotatalliesWhereInputObjectSchema)
      .array()
      .optional(),
    NOT: z
      .union([
        z.lazy(() => FtpquotatalliesWhereInputObjectSchema),
        z.lazy(() => FtpquotatalliesWhereInputObjectSchema).array(),
      ])
      .optional(),
    name: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
    quota_type: z
      .union([
        z.lazy(() => Enumftpquotatallies_quota_typeFilterObjectSchema),
        z.lazy(() => ftpquotatallies_quota_typeSchema),
      ])
      .optional(),
    bytes_in_used: z
      .union([z.lazy(() => BigIntFilterObjectSchema), z.bigint()])
      .optional(),
    bytes_out_used: z
      .union([z.lazy(() => BigIntFilterObjectSchema), z.bigint()])
      .optional(),
    bytes_xfer_used: z
      .union([z.lazy(() => BigIntFilterObjectSchema), z.bigint()])
      .optional(),
    files_in_used: z
      .union([z.lazy(() => IntFilterObjectSchema), z.number()])
      .optional(),
    files_out_used: z
      .union([z.lazy(() => IntFilterObjectSchema), z.number()])
      .optional(),
    files_xfer_used: z
      .union([z.lazy(() => IntFilterObjectSchema), z.number()])
      .optional(),
    id: z.union([z.lazy(() => IntFilterObjectSchema), z.number()]).optional(),
  })
  .strict();

export const FtpquotatalliesWhereInputObjectSchema = Schema;
