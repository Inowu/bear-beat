import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { UsersSelectObjectSchema } from './UsersSelect.schema';

const Schema: z.ZodType<Prisma.UsersArgs> = z
  .object({
    select: z.lazy(() => UsersSelectObjectSchema).optional(),
  })
  .strict();

export const UsersArgsObjectSchema = Schema;
