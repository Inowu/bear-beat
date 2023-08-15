import { z } from 'zod';
import { NullableStringFieldUpdateOperationsInputObjectSchema } from './NullableStringFieldUpdateOperationsInput.schema';
import { ftpquotalimits_quota_typeSchema } from '../enums/ftpquotalimits_quota_type.schema';
import { Enumftpquotalimits_quota_typeFieldUpdateOperationsInputObjectSchema } from './Enumftpquotalimits_quota_typeFieldUpdateOperationsInput.schema';
import { ftpquotalimits_per_sessionSchema } from '../enums/ftpquotalimits_per_session.schema';
import { Enumftpquotalimits_per_sessionFieldUpdateOperationsInputObjectSchema } from './Enumftpquotalimits_per_sessionFieldUpdateOperationsInput.schema';
import { ftpquotalimits_limit_typeSchema } from '../enums/ftpquotalimits_limit_type.schema';
import { Enumftpquotalimits_limit_typeFieldUpdateOperationsInputObjectSchema } from './Enumftpquotalimits_limit_typeFieldUpdateOperationsInput.schema';
import { BigIntFieldUpdateOperationsInputObjectSchema } from './BigIntFieldUpdateOperationsInput.schema';
import { IntFieldUpdateOperationsInputObjectSchema } from './IntFieldUpdateOperationsInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.FtpQuotaLimitsUpdateManyMutationInput> = z
  .object({
    name: z
      .union([
        z.string(),
        z.lazy(() => NullableStringFieldUpdateOperationsInputObjectSchema),
      ])
      .optional()
      .nullable(),
    quota_type: z
      .union([
        z.lazy(() => ftpquotalimits_quota_typeSchema),
        z.lazy(
          () =>
            Enumftpquotalimits_quota_typeFieldUpdateOperationsInputObjectSchema,
        ),
      ])
      .optional(),
    per_session: z
      .union([
        z.lazy(() => ftpquotalimits_per_sessionSchema),
        z.lazy(
          () =>
            Enumftpquotalimits_per_sessionFieldUpdateOperationsInputObjectSchema,
        ),
      ])
      .optional(),
    limit_type: z
      .union([
        z.lazy(() => ftpquotalimits_limit_typeSchema),
        z.lazy(
          () =>
            Enumftpquotalimits_limit_typeFieldUpdateOperationsInputObjectSchema,
        ),
      ])
      .optional(),
    bytes_in_avail: z
      .union([
        z.bigint(),
        z.lazy(() => BigIntFieldUpdateOperationsInputObjectSchema),
      ])
      .optional(),
    bytes_out_avail: z
      .union([
        z.bigint(),
        z.lazy(() => BigIntFieldUpdateOperationsInputObjectSchema),
      ])
      .optional(),
    bytes_xfer_avail: z
      .union([
        z.bigint(),
        z.lazy(() => BigIntFieldUpdateOperationsInputObjectSchema),
      ])
      .optional(),
    files_in_avail: z
      .union([
        z.number(),
        z.lazy(() => IntFieldUpdateOperationsInputObjectSchema),
      ])
      .optional(),
    files_out_avail: z
      .union([
        z.number(),
        z.lazy(() => IntFieldUpdateOperationsInputObjectSchema),
      ])
      .optional(),
    files_xfer_avail: z
      .union([
        z.number(),
        z.lazy(() => IntFieldUpdateOperationsInputObjectSchema),
      ])
      .optional(),
  })
  .strict();

export const FtpQuotaLimitsUpdateManyMutationInputObjectSchema = Schema;
