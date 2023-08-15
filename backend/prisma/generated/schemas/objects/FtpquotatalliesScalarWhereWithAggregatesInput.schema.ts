import { z } from 'zod';
import { StringWithAggregatesFilterObjectSchema } from './StringWithAggregatesFilter.schema';
import { Enumftpquotatallies_quota_typeWithAggregatesFilterObjectSchema } from './Enumftpquotatallies_quota_typeWithAggregatesFilter.schema';
import { ftpquotatallies_quota_typeSchema } from '../enums/ftpquotatallies_quota_type.schema';
import { BigIntWithAggregatesFilterObjectSchema } from './BigIntWithAggregatesFilter.schema';
import { IntWithAggregatesFilterObjectSchema } from './IntWithAggregatesFilter.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpquotatalliesScalarWhereWithAggregatesInput> =
  z
    .object({
      AND: z
        .union([
          z.lazy(
            () => FtpquotatalliesScalarWhereWithAggregatesInputObjectSchema,
          ),
          z
            .lazy(
              () => FtpquotatalliesScalarWhereWithAggregatesInputObjectSchema,
            )
            .array(),
        ])
        .optional(),
      OR: z
        .lazy(() => FtpquotatalliesScalarWhereWithAggregatesInputObjectSchema)
        .array()
        .optional(),
      NOT: z
        .union([
          z.lazy(
            () => FtpquotatalliesScalarWhereWithAggregatesInputObjectSchema,
          ),
          z
            .lazy(
              () => FtpquotatalliesScalarWhereWithAggregatesInputObjectSchema,
            )
            .array(),
        ])
        .optional(),
      name: z
        .union([
          z.lazy(() => StringWithAggregatesFilterObjectSchema),
          z.string(),
        ])
        .optional(),
      quota_type: z
        .union([
          z.lazy(
            () =>
              Enumftpquotatallies_quota_typeWithAggregatesFilterObjectSchema,
          ),
          z.lazy(() => ftpquotatallies_quota_typeSchema),
        ])
        .optional(),
      bytes_in_used: z
        .union([
          z.lazy(() => BigIntWithAggregatesFilterObjectSchema),
          z.bigint(),
        ])
        .optional(),
      bytes_out_used: z
        .union([
          z.lazy(() => BigIntWithAggregatesFilterObjectSchema),
          z.bigint(),
        ])
        .optional(),
      bytes_xfer_used: z
        .union([
          z.lazy(() => BigIntWithAggregatesFilterObjectSchema),
          z.bigint(),
        ])
        .optional(),
      files_in_used: z
        .union([z.lazy(() => IntWithAggregatesFilterObjectSchema), z.number()])
        .optional(),
      files_out_used: z
        .union([z.lazy(() => IntWithAggregatesFilterObjectSchema), z.number()])
        .optional(),
      files_xfer_used: z
        .union([z.lazy(() => IntWithAggregatesFilterObjectSchema), z.number()])
        .optional(),
      id: z
        .union([z.lazy(() => IntWithAggregatesFilterObjectSchema), z.number()])
        .optional(),
    })
    .strict();

export const FtpquotatalliesScalarWhereWithAggregatesInputObjectSchema = Schema;
