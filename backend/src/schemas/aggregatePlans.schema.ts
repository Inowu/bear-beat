import { z } from 'zod';
import { PlansOrderByWithRelationInputObjectSchema } from './objects/PlansOrderByWithRelationInput.schema';
import { PlansWhereInputObjectSchema } from './objects/PlansWhereInput.schema';
import { PlansWhereUniqueInputObjectSchema } from './objects/PlansWhereUniqueInput.schema';
import { PlansCountAggregateInputObjectSchema } from './objects/PlansCountAggregateInput.schema';
import { PlansMinAggregateInputObjectSchema } from './objects/PlansMinAggregateInput.schema';
import { PlansMaxAggregateInputObjectSchema } from './objects/PlansMaxAggregateInput.schema';
import { PlansAvgAggregateInputObjectSchema } from './objects/PlansAvgAggregateInput.schema';
import { PlansSumAggregateInputObjectSchema } from './objects/PlansSumAggregateInput.schema';

export const PlansAggregateSchema = z.object({
  orderBy: z
    .union([
      PlansOrderByWithRelationInputObjectSchema,
      PlansOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: PlansWhereInputObjectSchema.optional(),
  cursor: PlansWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  _count: z
    .union([z.literal(true), PlansCountAggregateInputObjectSchema])
    .optional(),
  _min: PlansMinAggregateInputObjectSchema.optional(),
  _max: PlansMaxAggregateInputObjectSchema.optional(),
  _avg: PlansAvgAggregateInputObjectSchema.optional(),
  _sum: PlansSumAggregateInputObjectSchema.optional(),
});
