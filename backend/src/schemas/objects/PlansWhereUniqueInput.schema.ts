import { z } from "zod";

import type { Prisma } from "@prisma/client";

const Schema: z.ZodType<Prisma.PlansWhereUniqueInput> = z
  .object({
    id: z.number(),
  })
  .strict();

export const PlansWhereUniqueInputObjectSchema = Schema;
