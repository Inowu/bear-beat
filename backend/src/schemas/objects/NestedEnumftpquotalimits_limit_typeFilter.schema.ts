import { z } from "zod";
import { ftpquotalimits_limit_typeSchema } from "../enums/ftpquotalimits_limit_type.schema";

import type { Prisma } from "@prisma/client";

const Schema: z.ZodType<Prisma.NestedEnumftpquotalimits_limit_typeFilter> = z
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
        z.lazy(() => NestedEnumftpquotalimits_limit_typeFilterObjectSchema),
      ])
      .optional(),
  })
  .strict();

export const NestedEnumftpquotalimits_limit_typeFilterObjectSchema = Schema;
