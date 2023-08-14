import { z } from "zod";
import { ftpquotatallies_history_quota_typeSchema } from "../enums/ftpquotatallies_history_quota_type.schema";
import { NestedEnumftpquotatallies_history_quota_typeWithAggregatesFilterObjectSchema } from "./NestedEnumftpquotatallies_history_quota_typeWithAggregatesFilter.schema";
import { NestedIntFilterObjectSchema } from "./NestedIntFilter.schema";
import { NestedEnumftpquotatallies_history_quota_typeFilterObjectSchema } from "./NestedEnumftpquotatallies_history_quota_typeFilter.schema";

import type { Prisma } from "@prisma/client";

const Schema: z.ZodType<Prisma.Enumftpquotatallies_history_quota_typeWithAggregatesFilter> =
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
            () =>
              NestedEnumftpquotatallies_history_quota_typeWithAggregatesFilterObjectSchema
          ),
        ])
        .optional(),
      _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
      _min: z
        .lazy(
          () => NestedEnumftpquotatallies_history_quota_typeFilterObjectSchema
        )
        .optional(),
      _max: z
        .lazy(
          () => NestedEnumftpquotatallies_history_quota_typeFilterObjectSchema
        )
        .optional(),
    })
    .strict();

export const Enumftpquotatallies_history_quota_typeWithAggregatesFilterObjectSchema =
  Schema;
