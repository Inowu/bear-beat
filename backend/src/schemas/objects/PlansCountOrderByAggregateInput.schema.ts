import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.PlansCountOrderByAggregateInput> = z
  .object({
    id: z.lazy(() => SortOrderSchema).optional(),
    name: z.lazy(() => SortOrderSchema).optional(),
    description: z.lazy(() => SortOrderSchema).optional(),
    moneda: z.lazy(() => SortOrderSchema).optional(),
    homedir: z.lazy(() => SortOrderSchema).optional(),
    gigas: z.lazy(() => SortOrderSchema).optional(),
    price: z.lazy(() => SortOrderSchema).optional(),
    duration: z.lazy(() => SortOrderSchema).optional(),
    activated: z.lazy(() => SortOrderSchema).optional(),
    tokens: z.lazy(() => SortOrderSchema).optional(),
    audio_ilimitado: z.lazy(() => SortOrderSchema).optional(),
    tokens_video: z.lazy(() => SortOrderSchema).optional(),
    video_ilimitado: z.lazy(() => SortOrderSchema).optional(),
    tokens_karaoke: z.lazy(() => SortOrderSchema).optional(),
    karaoke_ilimitado: z.lazy(() => SortOrderSchema).optional(),
    ilimitado_activo: z.lazy(() => SortOrderSchema).optional(),
    ilimitado_dias: z.lazy(() => SortOrderSchema).optional(),
    stripe_prod_id: z.lazy(() => SortOrderSchema).optional(),
    stripe_prod_id_test: z.lazy(() => SortOrderSchema).optional(),
    vip_activo: z.lazy(() => SortOrderSchema).optional(),
  })
  .strict();

export const PlansCountOrderByAggregateInputObjectSchema = Schema;
