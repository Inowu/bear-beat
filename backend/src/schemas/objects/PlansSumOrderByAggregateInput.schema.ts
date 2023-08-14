import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.PlansSumOrderByAggregateInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    gigas: z.lazy(() => SortOrderSchema).optional(),
    price: z.lazy(() => SortOrderSchema).optional(),
    activated: z.lazy(() => SortOrderSchema).optional(),
    tokens: z.lazy(() => SortOrderSchema).optional(),
    audio_ilimitado: z.lazy(() => SortOrderSchema).optional(),
    tokens_video: z.lazy(() => SortOrderSchema).optional(),
    video_ilimitado: z.lazy(() => SortOrderSchema).optional(),
    tokens_karaoke: z.lazy(() => SortOrderSchema).optional(),
    karaoke_ilimitado: z.lazy(() => SortOrderSchema).optional(),
    ilimitado_activo: z.lazy(() => SortOrderSchema).optional(),
    ilimitado_dias: z.lazy(() => SortOrderSchema).optional(),
    vip_activo: z.lazy(() => SortOrderSchema).optional(),
  })
  .strict();

export const PlansSumOrderByAggregateInputObjectSchema = Schema;
