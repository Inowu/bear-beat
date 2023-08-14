import { z } from 'zod';
import { UsersOrderByWithRelationInputObjectSchema } from './objects/UsersOrderByWithRelationInput.schema';
import { UsersWhereInputObjectSchema } from './objects/UsersWhereInput.schema';
import { UsersWhereUniqueInputObjectSchema } from './objects/UsersWhereUniqueInput.schema';
import { UsersCountAggregateInputObjectSchema } from './objects/UsersCountAggregateInput.schema';
import { UsersMinAggregateInputObjectSchema } from './objects/UsersMinAggregateInput.schema';
import { UsersMaxAggregateInputObjectSchema } from './objects/UsersMaxAggregateInput.schema';
import { UsersAvgAggregateInputObjectSchema } from './objects/UsersAvgAggregateInput.schema';
import { UsersSumAggregateInputObjectSchema } from './objects/UsersSumAggregateInput.schema';

export const UsersAggregateSchema = z.object({
  orderBy: z
    .union([
      UsersOrderByWithRelationInputObjectSchema,
      UsersOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: UsersWhereInputObjectSchema.optional(),
  cursor: UsersWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  _count: z
    .union([z.literal(true), UsersCountAggregateInputObjectSchema])
    .optional(),
  _min: UsersMinAggregateInputObjectSchema.optional(),
  _max: UsersMaxAggregateInputObjectSchema.optional(),
  _avg: UsersAvgAggregateInputObjectSchema.optional(),
  _sum: UsersSumAggregateInputObjectSchema.optional(),
});
