import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { IntFilterObjectSchema } from './IntFilter.schema';
import { StringFilterObjectSchema } from './StringFilter.schema';
import { Enumftpquotatallies_history_quota_typeFilterObjectSchema } from './Enumftpquotatallies_history_quota_typeFilter.schema';
import { ftpquotatallies_history_quota_typeSchema } from '../enums/ftpquotatallies_history_quota_type.schema';
import { BigIntFilterObjectSchema } from './BigIntFilter.schema';

const Schema: z.ZodType<Prisma.FtpQuotaTalliesHistoryWhereInput> = z
  .object({
    AND: z
      .union([
        z.lazy(() => FtpQuotatAlliesHistoryWhereInputObjectSchema),
        z.lazy(() => FtpQuotatAlliesHistoryWhereInputObjectSchema).array(),
      ])
      .optional(),
    OR: z
      .lazy(() => FtpQuotatAlliesHistoryWhereInputObjectSchema)
      .array()
      .optional(),
    NOT: z
      .union([
        z.lazy(() => FtpQuotatAlliesHistoryWhereInputObjectSchema),
        z.lazy(() => FtpQuotatAlliesHistoryWhereInputObjectSchema).array(),
      ])
      .optional(),
    id: z.union([z.lazy(() => IntFilterObjectSchema), z.number()]).optional(),
    name: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
    quota_type: z
      .union([
        z.lazy(() => Enumftpquotatallies_history_quota_typeFilterObjectSchema),
        z.lazy(() => ftpquotatallies_history_quota_typeSchema),
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
  })
  .strict();

export const FtpQuotatAlliesHistoryWhereInputObjectSchema = Schema;
