import { z } from "zod";

import type { Prisma } from "@prisma/client";

const Schema: z.ZodType<Prisma.CuponsWhereUniqueInput> = z
  .object({
    id: z.number(),
    code: z.string().optional(),
  })
  .strict();

export const CuponsWhereUniqueInputObjectSchema = Schema;
