import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { RolesCountOutputTypeSelectObjectSchema } from './RolesCountOutputTypeSelect.schema';

const Schema: z.ZodType<Prisma.RolesCountArgs> = z
  .object({
    select: z.lazy(() => RolesCountOutputTypeSelectObjectSchema).optional(),
  })
  .strict();

export const RolesCountOutputTypeArgsObjectSchema = Schema;
