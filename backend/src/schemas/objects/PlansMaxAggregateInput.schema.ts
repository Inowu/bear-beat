import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.PlansMaxAggregateInputType> = z
  .object({
    id: z.literal(true).optional(),
    name: z.literal(true).optional(),
    description: z.literal(true).optional(),
    moneda: z.literal(true).optional(),
    homedir: z.literal(true).optional(),
    gigas: z.literal(true).optional(),
    price: z.literal(true).optional(),
    duration: z.literal(true).optional(),
    activated: z.literal(true).optional(),
    tokens: z.literal(true).optional(),
    audio_ilimitado: z.literal(true).optional(),
    tokens_video: z.literal(true).optional(),
    video_ilimitado: z.literal(true).optional(),
    tokens_karaoke: z.literal(true).optional(),
    karaoke_ilimitado: z.literal(true).optional(),
    ilimitado_activo: z.literal(true).optional(),
    ilimitado_dias: z.literal(true).optional(),
    stripe_prod_id: z.literal(true).optional(),
    stripe_prod_id_test: z.literal(true).optional(),
    vip_activo: z.literal(true).optional(),
  })
  .strict();

export const PlansMaxAggregateInputObjectSchema = Schema;
