import { z } from 'zod';
import { OrdersSelectObjectSchema } from './objects/OrdersSelect.schema';
import { OrdersOrderByWithRelationInputObjectSchema } from './objects/OrdersOrderByWithRelationInput.schema';
import { OrdersWhereInputObjectSchema } from './objects/OrdersWhereInput.schema';
import { OrdersWhereUniqueInputObjectSchema } from './objects/OrdersWhereUniqueInput.schema';
import { OrdersScalarFieldEnumSchema } from './enums/OrdersScalarFieldEnum.schema';

export const OrdersFindManySchema = z.object({
  select: z.lazy(() => OrdersSelectObjectSchema.optional()),
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
