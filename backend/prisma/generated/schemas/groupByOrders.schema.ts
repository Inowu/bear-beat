import { z } from 'zod';
import { OrdersWhereInputObjectSchema } from './objects/OrdersWhereInput.schema';
import { OrdersOrderByWithAggregationInputObjectSchema } from './objects/OrdersOrderByWithAggregationInput.schema';
import { OrdersScalarWhereWithAggregatesInputObjectSchema } from './objects/OrdersScalarWhereWithAggregatesInput.schema';
import { OrdersScalarFieldEnumSchema } from './enums/OrdersScalarFieldEnum.schema';

export const OrdersGroupBySchema = z.object({
  where: OrdersWhereInputObjectSchema.optional(),
  orderBy: z
    .union([
      OrdersOrderByWithAggregationInputObjectSchema,
      OrdersOrderByWithAggregationInputObjectSchema.array(),
    ])
    .optional(),
  having: OrdersScalarWhereWithAggregatesInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  by: z.array(OrdersScalarFieldEnumSchema),
});
