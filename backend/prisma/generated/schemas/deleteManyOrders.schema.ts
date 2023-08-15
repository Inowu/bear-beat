import { z } from 'zod';
import { OrdersWhereInputObjectSchema } from './objects/OrdersWhereInput.schema';

export const OrdersDeleteManySchema = z.object({
  where: OrdersWhereInputObjectSchema.optional(),
});
