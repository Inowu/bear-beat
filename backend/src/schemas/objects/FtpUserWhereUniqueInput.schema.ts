import { z } from "zod";

import type { Prisma } from "@prisma/client";

const Schema: z.ZodType<Prisma.FtpUserWhereUniqueInput> = z
  .object({
    id: z.number(),
    userid: z.string().optional(),
  })
  .strict();

export const FtpUserWhereUniqueInputObjectSchema = Schema;
