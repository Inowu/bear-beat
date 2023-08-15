import { z } from 'zod';
import { OrdersWhereUniqueInputObjectSchema } from './objects/OrdersWhereUniqueInput.schema';

export const OrdersFindUniqueSchema = z.object({
  where: OrdersWhereUniqueInputObjectSchema,
});
