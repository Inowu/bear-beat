import { z } from "zod";

import type { Prisma } from "@prisma/client";

const Schema: z.ZodType<Prisma.OrdersWhereUniqueInput> = z
  .object({
    id: z.number(),
  })
  .strict();

export const OrdersWhereUniqueInputObjectSchema = Schema;
