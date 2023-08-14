import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.UsersMaxAggregateInputType> = z
  .object({
    id: z.literal(true).optional(),
    registered_on: z.literal(true).optional(),
    username: z.literal(true).optional(),
    password: z.literal(true).optional(),
    first_name: z.literal(true).optional(),
    last_name: z.literal(true).optional(),
    address: z.literal(true).optional(),
    birthdate: z.literal(true).optional(),
    email: z.literal(true).optional(),
    stripe_cusid: z.literal(true).optional(),
    conekta_cusid: z.literal(true).optional(),
    phone: z.literal(true).optional(),
    city: z.literal(true).optional(),
    role_id: z.literal(true).optional(),
    country_id: z.literal(true).optional(),
    profile_img: z.literal(true).optional(),
    active: z.literal(true).optional(),
    activationcode: z.literal(true).optional(),
    mc_id: z.literal(true).optional(),
    ip_registro: z.literal(true).optional(),
  })
  .strict();

export const UsersMaxAggregateInputObjectSchema = Schema;
