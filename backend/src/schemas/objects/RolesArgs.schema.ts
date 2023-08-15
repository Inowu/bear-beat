import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { RolesSelectObjectSchema } from './RolesSelect.schema';

const Schema: z.ZodType<Prisma.RolesArgs> = z
  .object({
    select: z.lazy(() => RolesSelectObjectSchema).optional(),
  })
  .strict();

export const RolesArgsObjectSchema = Schema;
