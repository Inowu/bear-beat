import { z } from 'zod';
import { OrdersWhereUniqueInputObjectSchema } from './objects/OrdersWhereUniqueInput.schema';

export const OrdersDeleteOneSchema = z.object({
  where: OrdersWhereUniqueInputObjectSchema,
});
