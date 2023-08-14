import { z } from 'zod';
import { OrdersSelectObjectSchema } from './objects/OrdersSelect.schema';
import { OrdersWhereUniqueInputObjectSchema } from './objects/OrdersWhereUniqueInput.schema';

export const OrdersFindUniqueSchema = z.object({
  select: OrdersSelectObjectSchema.optional(),
  where: OrdersWhereUniqueInputObjectSchema,
});
