import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.PlansCreateInput> = z
  .object({
    name: z.string(),
    description: z.string(),
    moneda: z.string().optional(),
    homedir: z.string(),
    gigas: z.bigint().optional(),
    price: z.number(),
    duration: z.string(),
    activated: z.number().optional(),
    tokens: z.number().optional().nullable(),
    audio_ilimitado: z.number().optional().nullable(),
    tokens_video: z.number().optional().nullable(),
    video_ilimitado: z.number().optional().nullable(),
    tokens_karaoke: z.number().optional().nullable(),
    karaoke_ilimitado: z.number().optional().nullable(),
    ilimitado_activo: z.number().optional().nullable(),
    ilimitado_dias: z.number().optional().nullable(),
    stripe_prod_id: z.string().optional().nullable(),
    stripe_prod_id_test: z.string(),
    vip_activo: z.number().optional().nullable(),
  })
  .strict();

export const PlansCreateInputObjectSchema = Schema;
