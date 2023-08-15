import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.UsersCountOrderByAggregateInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    registered_on: z.lazy(() => SortOrderSchema).optional(),
    username: z.lazy(() => SortOrderSchema).optional(),
    password: z.lazy(() => SortOrderSchema).optional(),
    first_name: z.lazy(() => SortOrderSchema).optional(),
    last_name: z.lazy(() => SortOrderSchema).optional(),
    address: z.lazy(() => SortOrderSchema).optional(),
    birthdate: z.lazy(() => SortOrderSchema).optional(),
    email: z.lazy(() => SortOrderSchema).optional(),
    stripe_cusid: z.lazy(() => SortOrderSchema).optional(),
    conekta_cusid: z.lazy(() => SortOrderSchema).optional(),
    phone: z.lazy(() => SortOrderSchema).optional(),
    city: z.lazy(() => SortOrderSchema).optional(),
    role_id: z.lazy(() => SortOrderSchema).optional(),
    country_id: z.lazy(() => SortOrderSchema).optional(),
    profile_img: z.lazy(() => SortOrderSchema).optional(),
    active: z.lazy(() => SortOrderSchema).optional(),
    activationcode: z.lazy(() => SortOrderSchema).optional(),
    mc_id: z.lazy(() => SortOrderSchema).optional(),
    ip_registro: z.lazy(() => SortOrderSchema).optional(),
  })
  .strict();

export const UsersCountOrderByAggregateInputObjectSchema = Schema;
