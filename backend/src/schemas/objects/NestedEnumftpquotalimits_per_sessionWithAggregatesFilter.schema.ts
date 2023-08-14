import { z } from "zod";
import { ftpquotalimits_per_sessionSchema } from "../enums/ftpquotalimits_per_session.schema";
import { NestedIntFilterObjectSchema } from "./NestedIntFilter.schema";
import { NestedEnumftpquotalimits_per_sessionFilterObjectSchema } from "./NestedEnumftpquotalimits_per_sessionFilter.schema";

import type { Prisma } from "@prisma/client";

const Schema: z.ZodType<Prisma.NestedEnumftpquotalimits_per_sessionWithAggregatesFilter> =
  z
    .object({
      equals: z.lazy(() => ftpquotalimits_per_sessionSchema).optional(),
      in: z
        .lazy(() => ftpquotalimits_per_sessionSchema)
        .array()
        .optional(),
      notIn: z
        .lazy(() => ftpquotalimits_per_sessionSchema)
        .array()
        .optional(),
      not: z
        .union([
          z.lazy(() => ftpquotalimits_per_sessionSchema),
          z.lazy(
            () =>
              NestedEnumftpquotalimits_per_sessionWithAggregatesFilterObjectSchema
          ),
        ])
        .optional(),
      _count: z.lazy(() => NestedIntFilterObjectSchema).optional(),
      _min: z
        .lazy(() => NestedEnumftpquotalimits_per_sessionFilterObjectSchema)
        .optional(),
      _max: z
        .lazy(() => NestedEnumftpquotalimits_per_sessionFilterObjectSchema)
        .optional(),
    })
    .strict();

export const NestedEnumftpquotalimits_per_sessionWithAggregatesFilterObjectSchema =
  Schema;
