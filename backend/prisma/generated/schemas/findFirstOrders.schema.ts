import { z } from 'zod';
import { OrdersOrderByWithRelationInputObjectSchema } from './objects/OrdersOrderByWithRelationInput.schema';
import { OrdersWhereInputObjectSchema } from './objects/OrdersWhereInput.schema';
import { OrdersWhereUniqueInputObjectSchema } from './objects/OrdersWhereUniqueInput.schema';
import { OrdersScalarFieldEnumSchema } from './enums/OrdersScalarFieldEnum.schema';

export const OrdersFindFirstSchema = z.object({
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
  distinct: z.array(OrdersScalarFieldEnumSchema).optional(),
});
