import { z } from 'zod';
import { LoginHistoryOrderByWithRelationInputObjectSchema } from './objects/LoginHistoryOrderByWithRelationInput.schema';
import { LoginHistoryWhereInputObjectSchema } from './objects/LoginHistoryWhereInput.schema';
import { LoginHistoryWhereUniqueInputObjectSchema } from './objects/LoginHistoryWhereUniqueInput.schema';
import { LoginHistoryCountAggregateInputObjectSchema } from './objects/LoginHistoryCountAggregateInput.schema';
import { LoginHistoryMinAggregateInputObjectSchema } from './objects/LoginHistoryMinAggregateInput.schema';
import { LoginHistoryMaxAggregateInputObjectSchema } from './objects/LoginHistoryMaxAggregateInput.schema';
import { LoginHistoryAvgAggregateInputObjectSchema } from './objects/LoginHistoryAvgAggregateInput.schema';
import { LoginHistorySumAggregateInputObjectSchema } from './objects/LoginHistorySumAggregateInput.schema';

export const LoginHistoryAggregateSchema = z.object({
  orderBy: z
    .union([
      LoginHistoryOrderByWithRelationInputObjectSchema,
      LoginHistoryOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: LoginHistoryWhereInputObjectSchema.optional(),
  cursor: LoginHistoryWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  _count: z
    .union([z.literal(true), LoginHistoryCountAggregateInputObjectSchema])
    .optional(),
  _min: LoginHistoryMinAggregateInputObjectSchema.optional(),
  _max: LoginHistoryMaxAggregateInputObjectSchema.optional(),
  _avg: LoginHistoryAvgAggregateInputObjectSchema.optional(),
  _sum: LoginHistorySumAggregateInputObjectSchema.optional(),
});
