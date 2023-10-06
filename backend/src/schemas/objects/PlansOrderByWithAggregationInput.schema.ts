import { z } from 'zod';
import { SortOrderSchema } from '../enums/SortOrder.schema';
import { SortOrderInputObjectSchema } from './SortOrderInput.schema';
import { PlansCountOrderByAggregateInputObjectSchema } from './PlansCountOrderByAggregateInput.schema';
import { PlansAvgOrderByAggregateInputObjectSchema } from './PlansAvgOrderByAggregateInput.schema';
import { PlansMaxOrderByAggregateInputObjectSchema } from './PlansMaxOrderByAggregateInput.schema';
import { PlansMinOrderByAggregateInputObjectSchema } from './PlansMinOrderByAggregateInput.schema';
import { PlansSumOrderByAggregateInputObjectSchema } from './PlansSumOrderByAggregateInput.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.PlansOrderByWithAggregationInput> = z
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
    tokens: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    audio_ilimitado: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    tokens_video: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    video_ilimitado: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    tokens_karaoke: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    karaoke_ilimitado: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    ilimitado_activo: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    ilimitado_dias: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    stripe_prod_id: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    stripe_prod_id_test: z.lazy(() => SortOrderSchema).optional(),
    conekta_plan_id: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    conekta_plan_id_test: z.lazy(() => SortOrderSchema).optional(),
    paypal_plan_id: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    paypal_plan_id_test: z.lazy(() => SortOrderSchema).optional(),
    vip_activo: z
      .union([
        z.lazy(() => SortOrderSchema),
        z.lazy(() => SortOrderInputObjectSchema),
      ])
      .optional(),
    _count: z
      .lazy(() => PlansCountOrderByAggregateInputObjectSchema)
      .optional(),
    _avg: z.lazy(() => PlansAvgOrderByAggregateInputObjectSchema).optional(),
    _max: z.lazy(() => PlansMaxOrderByAggregateInputObjectSchema).optional(),
    _min: z.lazy(() => PlansMinOrderByAggregateInputObjectSchema).optional(),
    _sum: z.lazy(() => PlansSumOrderByAggregateInputObjectSchema).optional(),
  })
  .strict();

export const PlansOrderByWithAggregationInputObjectSchema = Schema;
