import { z } from 'zod';
import { OrdersOrderByWithRelationInputObjectSchema } from './objects/OrdersOrderByWithRelationInput.schema';
import { OrdersWhereInputObjectSchema } from './objects/OrdersWhereInput.schema';
import { OrdersWhereUniqueInputObjectSchema } from './objects/OrdersWhereUniqueInput.schema';
import { OrdersCountAggregateInputObjectSchema } from './objects/OrdersCountAggregateInput.schema';
import { OrdersMinAggregateInputObjectSchema } from './objects/OrdersMinAggregateInput.schema';
import { OrdersMaxAggregateInputObjectSchema } from './objects/OrdersMaxAggregateInput.schema';
import { OrdersAvgAggregateInputObjectSchema } from './objects/OrdersAvgAggregateInput.schema';
import { OrdersSumAggregateInputObjectSchema } from './objects/OrdersSumAggregateInput.schema';

export const OrdersAggregateSchema = z.object({
  orderBy: z
    .union([
      OrdersOrderByWithRelationInputObjectSchema,
      OrdersOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: OrdersWhereInputObjectSchema.optional(),
  cursor: OrdersWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  _count: z
    .union([z.literal(true), OrdersCountAggregateInputObjectSchema])
    .optional(),
  _min: OrdersMinAggregateInputObjectSchema.optional(),
  _max: OrdersMaxAggregateInputObjectSchema.optional(),
  _avg: OrdersAvgAggregateInputObjectSchema.optional(),
  _sum: OrdersSumAggregateInputObjectSchema.optional(),
});
