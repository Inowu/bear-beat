import { z } from "zod";
import { ftpquotatallies_history_quota_typeSchema } from "../enums/ftpquotatallies_history_quota_type.schema";

import type { Prisma } from "@prisma/client";

const Schema: z.ZodType<Prisma.NestedEnumftpquotatallies_history_quota_typeFilter> =
  z
    .object({
      equals: z.lazy(() => ftpquotatallies_history_quota_typeSchema).optional(),
      in: z
        .lazy(() => ftpquotatallies_history_quota_typeSchema)
        .array()
        .optional(),
      notIn: z
        .lazy(() => ftpquotatallies_history_quota_typeSchema)
        .array()
        .optional(),
      not: z
        .union([
          z.lazy(() => ftpquotatallies_history_quota_typeSchema),
          z.lazy(
            () => NestedEnumftpquotatallies_history_quota_typeFilterObjectSchema
          ),
        ])
        .optional(),
    })
    .strict();

export const NestedEnumftpquotatallies_history_quota_typeFilterObjectSchema =
  Schema;
