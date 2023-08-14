import { z } from "zod";

import type { Prisma } from "@prisma/client";

const Schema: z.ZodType<Prisma.CountriesWhereUniqueInput> = z
  .object({
    id: z.number(),
    name: z.string().optional(),
  })
  .strict();

export const CountriesWhereUniqueInputObjectSchema = Schema;
