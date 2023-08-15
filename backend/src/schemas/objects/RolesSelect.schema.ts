import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { RolesCountOutputTypeArgsObjectSchema } from './RolesCountOutputTypeArgs.schema';

const Schema: z.ZodType<Prisma.RolesSelect> = z
  .object({
    id: z.boolean().optional(),
    name: z.boolean().optional(),
    _count: z
      .union([z.boolean(), z.lazy(() => RolesCountOutputTypeArgsObjectSchema)])
      .optional(),
  })
  .strict();

export const RolesSelectObjectSchema = Schema;
