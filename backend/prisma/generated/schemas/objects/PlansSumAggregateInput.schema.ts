import { z } from 'zod';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.PlansSumAggregateInputType> = z
  .object({
    id: z.literal(true).optional(),
    gigas: z.literal(true).optional(),
    price: z.literal(true).optional(),
    activated: z.literal(true).optional(),
    tokens: z.literal(true).optional(),
    audio_ilimitado: z.literal(true).optional(),
    tokens_video: z.literal(true).optional(),
    video_ilimitado: z.literal(true).optional(),
    tokens_karaoke: z.literal(true).optional(),
    karaoke_ilimitado: z.literal(true).optional(),
    ilimitado_activo: z.literal(true).optional(),
    ilimitado_dias: z.literal(true).optional(),
    vip_activo: z.literal(true).optional(),
  })
  .strict();

export const PlansSumAggregateInputObjectSchema = Schema;
