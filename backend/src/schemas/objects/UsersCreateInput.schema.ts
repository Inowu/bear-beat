import { z } from 'zod';
import { RolesCreateNestedOneWithoutUsersInputObjectSchema } from './RolesCreateNestedOneWithoutUsersInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.UsersCreateInput> = z
  .object({
    registered_on: z.coerce.date().optional(),
    username: z.string(),
    password: z.string(),
    first_name: z.string().optional().nullable(),
    last_name: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    birthdate: z.coerce.date().optional().nullable(),
    email: z.string(),
    stripe_cusid: z.string().optional().nullable(),
    conekta_cusid: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    country_id: z.string().optional().nullable(),
    profile_img: z.string().optional().nullable(),
    active: z.number().optional(),
    activationcode: z.string().optional().nullable(),
    mc_id: z.number().optional().nullable(),
    ip_registro: z.string().optional().nullable(),
    role: z
      .lazy(() => RolesCreateNestedOneWithoutUsersInputObjectSchema)
      .optional(),
  })
  .strict();

export const UsersCreateInputObjectSchema = Schema;
