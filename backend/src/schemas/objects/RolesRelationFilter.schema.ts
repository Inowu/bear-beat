import { z } from "zod";
import { RolesWhereInputObjectSchema } from "./RolesWhereInput.schema";

import type { Prisma } from "@prisma/client";

const Schema: z.ZodType<Prisma.RolesNullableRelationFilter> = z
  .object({
    is: z
      .lazy(() => RolesWhereInputObjectSchema)
      .optional()
      .nullable(),
    isNot: z
      .lazy(() => RolesWhereInputObjectSchema)
      .optional()
      .nullable(),
  })
  .strict();

export const RolesRelationFilterObjectSchema = Schema;
