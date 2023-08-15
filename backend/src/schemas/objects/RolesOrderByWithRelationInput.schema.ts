import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { UsersOrderByRelationAggregateInputObjectSchema } from './UsersOrderByRelationAggregateInput.schema';

const Schema: z.ZodType<Prisma.RolesOrderByWithRelationInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    name: z.lazy(() => SortOrderSchema).optional(),
    users: z
      .lazy(() => UsersOrderByRelationAggregateInputObjectSchema)
      .optional(),
  })
  .strict();

export const RolesOrderByWithRelationInputObjectSchema = Schema;
