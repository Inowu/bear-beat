import { z } from "zod";
import { ftpquotalimits_limit_typeSchema } from "../enums/ftpquotalimits_limit_type.schema";
import { NestedEnumftpquotalimits_limit_typeWithAggregatesFilterObjectSchema } from "./NestedEnumftpquotalimits_limit_typeWithAggregatesFilter.schema";
import { NestedIntFilterObjectSchema } from "./NestedIntFilter.schema";
import { NestedEnumftpquotalimits_limit_typeFilterObjectSchema } from "./NestedEnumftpquotalimits_limit_typeFilter.schema";

import type { Prisma } from "@prisma/client";

const Schema: z.ZodType<Prisma.Enumftpquotalimits_limit_typeWithAggregatesFilter> =
  z
    .object({
      equals: z.lazy(() => ftpquotalimits_limit_typeSchema).optional(),
      in: z
        .lazy(() => ftpquotalimits_limit_typeSchema)
        .array()
        .optional(),
      notIn: z
        .lazy(() => ftpquotalimits_limit_typeSchema)
        .array()
        .optional(),
      not: z
        .union([
          z.lazy(() => ftpquotalimits_limit_typeSchema),
          z.lazy(
            () =>
              NestedEnumftpquotalimits_limit_typeWithAggregatesFilterObjectSchema
          ),
        ])
        .optional(),
      _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
      _min: z
        .lazy(() => NestedEnumftpquotalimits_limit_typeFilterObjectSchema)
        .optional(),
      _max: z
        .lazy(() => NestedEnumftpquotalimits_limit_typeFilterObjectSchema)
        .optional(),
    })
    .strict();

export const Enumftpquotalimits_limit_typeWithAggregatesFilterObjectSchema =
  Schema;
