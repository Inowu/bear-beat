import { z } from 'zod';
import { OrdersSelectObjectSchema } from './objects/OrdersSelect.schema';
import { OrdersCreateInputObjectSchema } from './objects/OrdersCreateInput.schema';
import { OrdersUncheckedCreateInputObjectSchema } from './objects/OrdersUncheckedCreateInput.schema';

export const OrdersCreateOneSchema = z.object({
  select: OrdersSelectObjectSchema.optional(),
  data: z.union([
    OrdersCreateInputObjectSchema,
    OrdersUncheckedCreateInputObjectSchema,
  ]),
});
