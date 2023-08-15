import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { IntWithAggregatesFilterObjectSchema } from './IntWithAggregatesFilter.schema';
import { StringWithAggregatesFilterObjectSchema } from './StringWithAggregatesFilter.schema';
import { Enumftpquotatallies_history_quota_typeWithAggregatesFilterObjectSchema } from './Enumftpquotatallies_history_quota_typeWithAggregatesFilter.schema';
import { ftpquotatallies_history_quota_typeSchema } from '../enums/ftpquotatallies_history_quota_type.schema';
import { BigIntWithAggregatesFilterObjectSchema } from './BigIntWithAggregatesFilter.schema';

const Schema: z.ZodType<Prisma.FtpQuotaTalliesHistoryScalarWhereWithAggregatesInput> =
  z
    .object({
      AND: z
        .union([
          z.lazy(
            () =>
              FtpQuotatAlliesHistoryScalarWhereWithAggregatesInputObjectSchema,
          ),
          z
            .lazy(
              () =>
                FtpQuotatAlliesHistoryScalarWhereWithAggregatesInputObjectSchema,
            )
            .array(),
        ])
        .optional(),
      OR: z
        .lazy(
          () =>
            FtpQuotatAlliesHistoryScalarWhereWithAggregatesInputObjectSchema,
        )
        .array()
        .optional(),
      NOT: z
        .union([
          z.lazy(
            () =>
              FtpQuotatAlliesHistoryScalarWhereWithAggregatesInputObjectSchema,
          ),
          z
            .lazy(
              () =>
                FtpQuotatAlliesHistoryScalarWhereWithAggregatesInputObjectSchema,
            )
            .array(),
        ])
        .optional(),
      id: z
        .union([z.lazy(() => IntWithAggregatesFilterObjectSchema), z.number()])
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
              Enumftpquotatallies_history_quota_typeWithAggregatesFilterObjectSchema,
          ),
          z.lazy(() => ftpquotatallies_history_quota_typeSchema),
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
    })
    .strict();

export const FtpQuotatAlliesHistoryScalarWhereWithAggregatesInputObjectSchema =
  Schema;
