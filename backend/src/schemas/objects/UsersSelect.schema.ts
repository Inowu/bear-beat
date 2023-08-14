import { z } from 'zod';
import { RolesArgsObjectSchema } from './RolesArgs.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.UsersSelect> = z
  .object({
    id: z.boolean().optional(),
    registered_on: z.boolean().optional(),
    username: z.boolean().optional(),
    password: z.boolean().optional(),
    first_name: z.boolean().optional(),
    last_name: z.boolean().optional(),
    address: z.boolean().optional(),
    birthdate: z.boolean().optional(),
    email: z.boolean().optional(),
    stripe_cusid: z.boolean().optional(),
    conekta_cusid: z.boolean().optional(),
    phone: z.boolean().optional(),
    city: z.boolean().optional(),
    role: z
      .union([z.boolean(), z.lazy(() => RolesArgsObjectSchema)])
      .optional(),
    role_id: z.boolean().optional(),
    country_id: z.boolean().optional(),
    profile_img: z.boolean().optional(),
    active: z.boolean().optional(),
    activationcode: z.boolean().optional(),
    mc_id: z.boolean().optional(),
    ip_registro: z.boolean().optional(),
  })
  .strict();

export const UsersSelectObjectSchema = Schema;
