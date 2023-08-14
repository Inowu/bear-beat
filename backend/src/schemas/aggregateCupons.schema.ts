import { z } from 'zod';
import { CuponsOrderByWithRelationInputObjectSchema } from './objects/CuponsOrderByWithRelationInput.schema';
import { CuponsWhereInputObjectSchema } from './objects/CuponsWhereInput.schema';
import { CuponsWhereUniqueInputObjectSchema } from './objects/CuponsWhereUniqueInput.schema';
import { CuponsCountAggregateInputObjectSchema } from './objects/CuponsCountAggregateInput.schema';
import { CuponsMinAggregateInputObjectSchema } from './objects/CuponsMinAggregateInput.schema';
import { CuponsMaxAggregateInputObjectSchema } from './objects/CuponsMaxAggregateInput.schema';
import { CuponsAvgAggregateInputObjectSchema } from './objects/CuponsAvgAggregateInput.schema';
import { CuponsSumAggregateInputObjectSchema } from './objects/CuponsSumAggregateInput.schema';

export const CuponsAggregateSchema = z.object({
  orderBy: z
    .union([
      CuponsOrderByWithRelationInputObjectSchema,
      CuponsOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: CuponsWhereInputObjectSchema.optional(),
  cursor: CuponsWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  _count: z
    .union([z.literal(true), CuponsCountAggregateInputObjectSchema])
    .optional(),
  _min: CuponsMinAggregateInputObjectSchema.optional(),
  _max: CuponsMaxAggregateInputObjectSchema.optional(),
  _avg: CuponsAvgAggregateInputObjectSchema.optional(),
  _sum: CuponsSumAggregateInputObjectSchema.optional(),
});
