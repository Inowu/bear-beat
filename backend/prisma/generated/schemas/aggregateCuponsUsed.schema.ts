import { z } from 'zod';
import { CuponsUsedOrderByWithRelationInputObjectSchema } from './objects/CuponsUsedOrderByWithRelationInput.schema';
import { CuponsUsedWhereInputObjectSchema } from './objects/CuponsUsedWhereInput.schema';
import { CuponsUsedWhereUniqueInputObjectSchema } from './objects/CuponsUsedWhereUniqueInput.schema';
import { CuponsUsedCountAggregateInputObjectSchema } from './objects/CuponsUsedCountAggregateInput.schema';
import { CuponsUsedMinAggregateInputObjectSchema } from './objects/CuponsUsedMinAggregateInput.schema';
import { CuponsUsedMaxAggregateInputObjectSchema } from './objects/CuponsUsedMaxAggregateInput.schema';
import { CuponsUsedAvgAggregateInputObjectSchema } from './objects/CuponsUsedAvgAggregateInput.schema';
import { CuponsUsedSumAggregateInputObjectSchema } from './objects/CuponsUsedSumAggregateInput.schema';

export const CuponsUsedAggregateSchema = z.object({
  orderBy: z
    .union([
      CuponsUsedOrderByWithRelationInputObjectSchema,
      CuponsUsedOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: CuponsUsedWhereInputObjectSchema.optional(),
  cursor: CuponsUsedWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  _count: z
    .union([z.literal(true), CuponsUsedCountAggregateInputObjectSchema])
    .optional(),
  _min: CuponsUsedMinAggregateInputObjectSchema.optional(),
  _max: CuponsUsedMaxAggregateInputObjectSchema.optional(),
  _avg: CuponsUsedAvgAggregateInputObjectSchema.optional(),
  _sum: CuponsUsedSumAggregateInputObjectSchema.optional(),
});
