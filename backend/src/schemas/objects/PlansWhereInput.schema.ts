import { z } from 'zod';
import { IntFilterObjectSchema } from './IntFilter.schema';
import { StringFilterObjectSchema } from './StringFilter.schema';
import { BigIntFilterObjectSchema } from './BigIntFilter.schema';
import { DecimalFilterObjectSchema } from './DecimalFilter.schema';
import { IntNullableFilterObjectSchema } from './IntNullableFilter.schema';
import { StringNullableFilterObjectSchema } from './StringNullableFilter.schema';

import type { Prisma } from '@prisma/client';

const Schema: z.ZodType<Prisma.PlansWhereInput> = z
  .object({
    AND: z
      .union([
        z.lazy(() => PlansWhereInputObjectSchema),
        z.lazy(() => PlansWhereInputObjectSchema).array(),
      ])
      .optional(),
    OR: z
      .lazy(() => PlansWhereInputObjectSchema)
      .array()
      .optional(),
    NOT: z
      .union([
        z.lazy(() => PlansWhereInputObjectSchema),
        z.lazy(() => PlansWhereInputObjectSchema).array(),
      ])
      .optional(),
    id: z.union([z.lazy(() => IntFilterObjectSchema), z.number()]).optional(),
    name: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
    description: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
    moneda: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
    homedir: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
    gigas: z
      .union([z.lazy(() => BigIntFilterObjectSchema), z.bigint()])
      .optional(),
    price: z
      .union([z.lazy(() => DecimalFilterObjectSchema), z.number()])
      .optional(),
    duration: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
    activated: z
      .union([z.lazy(() => IntFilterObjectSchema), z.number()])
      .optional(),
    tokens: z
      .union([z.lazy(() => IntNullableFilterObjectSchema), z.number()])
      .optional()
      .nullable(),
    audio_ilimitado: z
      .union([z.lazy(() => IntNullableFilterObjectSchema), z.number()])
      .optional()
      .nullable(),
    tokens_video: z
      .union([z.lazy(() => IntNullableFilterObjectSchema), z.number()])
      .optional()
      .nullable(),
    video_ilimitado: z
      .union([z.lazy(() => IntNullableFilterObjectSchema), z.number()])
      .optional()
      .nullable(),
    tokens_karaoke: z
      .union([z.lazy(() => IntNullableFilterObjectSchema), z.number()])
      .optional()
      .nullable(),
    karaoke_ilimitado: z
      .union([z.lazy(() => IntNullableFilterObjectSchema), z.number()])
      .optional()
      .nullable(),
    ilimitado_activo: z
      .union([z.lazy(() => IntNullableFilterObjectSchema), z.number()])
      .optional()
      .nullable(),
    ilimitado_dias: z
      .union([z.lazy(() => IntNullableFilterObjectSchema), z.number()])
      .optional()
      .nullable(),
    stripe_prod_id: z
      .union([z.lazy(() => StringNullableFilterObjectSchema), z.string()])
      .optional()
      .nullable(),
    stripe_prod_id_test: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
    conekta_plan_id: z
      .union([z.lazy(() => StringNullableFilterObjectSchema), z.string()])
      .optional()
      .nullable(),
    conekta_plan_id_test: z
      .union([z.lazy(() => StringFilterObjectSchema), z.string()])
      .optional(),
    vip_activo: z
      .union([z.lazy(() => IntNullableFilterObjectSchema), z.number()])
      .optional()
      .nullable(),
  })
  .strict();

export const PlansWhereInputObjectSchema = Schema;
