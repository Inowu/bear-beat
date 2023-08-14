import { z } from "zod";

import type { Prisma } from "@prisma/client";

const Schema: z.ZodType<Prisma.UsersWhereUniqueInput> = z
  .object({
    id: z.number(),
    username: z.string().optional(),
    email: z.string().optional(),
  })
  .strict();

export const UsersWhereUniqueInputObjectSchema = Schema;
