import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.PlansSelect> = z
  .object({
    id: z.boolean().optional(),
    name: z.boolean().optional(),
    description: z.boolean().optional(),
    moneda: z.boolean().optional(),
    homedir: z.boolean().optional(),
    gigas: z.boolean().optional(),
    price: z.boolean().optional(),
    duration: z.boolean().optional(),
    activated: z.boolean().optional(),
    tokens: z.boolean().optional(),
    audio_ilimitado: z.boolean().optional(),
    tokens_video: z.boolean().optional(),
    video_ilimitado: z.boolean().optional(),
    tokens_karaoke: z.boolean().optional(),
    karaoke_ilimitado: z.boolean().optional(),
    ilimitado_activo: z.boolean().optional(),
    ilimitado_dias: z.boolean().optional(),
    stripe_prod_id: z.boolean().optional(),
    stripe_prod_id_test: z.boolean().optional(),
    vip_activo: z.boolean().optional(),
  })
  .strict();

export const PlansSelectObjectSchema = Schema;
