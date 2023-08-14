import { z } from 'zod';
import { DescargasUserOrderByWithRelationInputObjectSchema } from './objects/DescargasUserOrderByWithRelationInput.schema';
import { DescargasUserWhereInputObjectSchema } from './objects/DescargasUserWhereInput.schema';
import { DescargasUserWhereUniqueInputObjectSchema } from './objects/DescargasUserWhereUniqueInput.schema';
import { DescargasUserCountAggregateInputObjectSchema } from './objects/DescargasUserCountAggregateInput.schema';
import { DescargasUserMinAggregateInputObjectSchema } from './objects/DescargasUserMinAggregateInput.schema';
import { DescargasUserMaxAggregateInputObjectSchema } from './objects/DescargasUserMaxAggregateInput.schema';
import { DescargasUserAvgAggregateInputObjectSchema } from './objects/DescargasUserAvgAggregateInput.schema';
import { DescargasUserSumAggregateInputObjectSchema } from './objects/DescargasUserSumAggregateInput.schema';

export const DescargasUserAggregateSchema = z.object({
  orderBy: z
    .union([
      DescargasUserOrderByWithRelationInputObjectSchema,
      DescargasUserOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: DescargasUserWhereInputObjectSchema.optional(),
  cursor: DescargasUserWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  _count: z
    .union([z.literal(true), DescargasUserCountAggregateInputObjectSchema])
    .optional(),
  _min: DescargasUserMinAggregateInputObjectSchema.optional(),
  _max: DescargasUserMaxAggregateInputObjectSchema.optional(),
  _avg: DescargasUserAvgAggregateInputObjectSchema.optional(),
  _sum: DescargasUserSumAggregateInputObjectSchema.optional(),
});
