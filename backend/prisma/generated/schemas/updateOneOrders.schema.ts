import { z } from 'zod';
import { OrdersUpdateInputObjectSchema } from './objects/OrdersUpdateInput.schema';
import { OrdersUncheckedUpdateInputObjectSchema } from './objects/OrdersUncheckedUpdateInput.schema';
import { OrdersWhereUniqueInputObjectSchema } from './objects/OrdersWhereUniqueInput.schema';

export const OrdersUpdateOneSchema = z.object({
  data: z.union([
    OrdersUpdateInputObjectSchema,
    OrdersUncheckedUpdateInputObjectSchema,
  ]),
  where: OrdersWhereUniqueInputObjectSchema,
});
