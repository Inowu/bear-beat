import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CuponsCreateInput> = z
  .object({
    code: z.string(),
    discount: z.number(),
    type: z.number(),
    cupon_condition: z.string().optional().nullable(),
    parameter: z.number().optional().nullable(),
    description: z.string().optional().nullable(),
    active: z.number().optional(),
  })
  .strict();

export const CuponsCreateInputObjectSchema = Schema;
