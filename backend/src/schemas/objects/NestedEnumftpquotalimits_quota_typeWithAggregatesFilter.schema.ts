import { z } from "zod";
import { ftpquotalimits_quota_typeSchema } from "../enums/ftpquotalimits_quota_type.schema";
import { NestedIntFilterObjectSchema } from "./NestedIntFilter.schema";
import { NestedEnumftpquotalimits_quota_typeFilterObjectSchema } from "./NestedEnumftpquotalimits_quota_typeFilter.schema";

import type { Prisma } from "@prisma/client";

const Schema: z.ZodType<Prisma.NestedEnumftpquotalimits_quota_typeWithAggregatesFilter> =
  z
    .object({
      equals: z.lazy(() => ftpquotalimits_quota_typeSchema).optional(),
      in: z
        .lazy(() => ftpquotalimits_quota_typeSchema)
        .array()
        .optional(),
      notIn: z
        .lazy(() => ftpquotalimits_quota_typeSchema)
        .array()
        .optional(),
      not: z
        .union([
          z.lazy(() => ftpquotalimits_quota_typeSchema),
          z.lazy(
            () =>
              NestedEnumftpquotalimits_quota_typeWithAggregatesFilterObjectSchema
          ),
        ])
        .optional(),
      _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
      _min: z
        .lazy(() => NestedEnumftpquotalimits_quota_typeFilterObjectSchema)
        .optional(),
      _max: z
        .lazy(() => NestedEnumftpquotalimits_quota_typeFilterObjectSchema)
        .optional(),
    })
    .strict();

export const NestedEnumftpquotalimits_quota_typeWithAggregatesFilterObjectSchema =
  Schema;
