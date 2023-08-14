import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.CuponsSelect> = z
  .object({
    id: z.boolean().optional(),
    code: z.boolean().optional(),
    discount: z.boolean().optional(),
    type: z.boolean().optional(),
    cupon_condition: z.boolean().optional(),
    parameter: z.boolean().optional(),
    description: z.boolean().optional(),
    active: z.boolean().optional(),
  })
  .strict();

export const CuponsSelectObjectSchema = Schema;
