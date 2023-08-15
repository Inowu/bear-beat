import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { StringFieldUpdateOperationsInputObjectSchema } from './StringFieldUpdateOperationsInput.schema';
import { ftpquotatallies_quota_typeSchema } from '../enums/ftpquotatallies_quota_type.schema';
import { Enumftpquotatallies_quota_typeFieldUpdateOperationsInputObjectSchema } from './Enumftpquotatallies_quota_typeFieldUpdateOperationsInput.schema';
import { BigIntFieldUpdateOperationsInputObjectSchema } from './BigIntFieldUpdateOperationsInput.schema';
import { IntFieldUpdateOperationsInputObjectSchema } from './IntFieldUpdateOperationsInput.schema';

const Schema: z.ZodType<Prisma.FtpquotatalliesUncheckedUpdateInput> = z
  .object({
    name: z
      .union([
        z.string(),
        z.lazy(() => StringFieldUpdateOperationsInputObjectSchema),
      ])
      .optional(),
    quota_type: z
      .union([
        z.lazy(() => ftpquotatallies_quota_typeSchema),
        z.lazy(
          () =>
            Enumftpquotatallies_quota_typeFieldUpdateOperationsInputObjectSchema,
        ),
      ])
      .optional(),
    bytes_in_used: z
      .union([
        z.bigint(),
        z.lazy(() => BigIntFieldUpdateOperationsInputObjectSchema),
      ])
      .optional(),
    bytes_out_used: z
      .union([
        z.bigint(),
        z.lazy(() => BigIntFieldUpdateOperationsInputObjectSchema),
      ])
      .optional(),
    bytes_xfer_used: z
      .union([
        z.bigint(),
        z.lazy(() => BigIntFieldUpdateOperationsInputObjectSchema),
      ])
      .optional(),
    files_in_used: z
      .union([
        z.number(),
        z.lazy(() => IntFieldUpdateOperationsInputObjectSchema),
      ])
      .optional(),
    files_out_used: z
      .union([
        z.number(),
        z.lazy(() => IntFieldUpdateOperationsInputObjectSchema),
      ])
      .optional(),
    files_xfer_used: z
      .union([
        z.number(),
        z.lazy(() => IntFieldUpdateOperationsInputObjectSchema),
      ])
      .optional(),
    id: z
      .union([
        z.number(),
        z.lazy(() => IntFieldUpdateOperationsInputObjectSchema),
      ])
      .optional(),
  })
  .strict();

export const FtpquotatalliesUncheckedUpdateInputObjectSchema = Schema;
