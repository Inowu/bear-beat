import { z } from 'zod';
import { OrdersCreateInputObjectSchema } from './objects/OrdersCreateInput.schema';
import { OrdersUncheckedCreateInputObjectSchema } from './objects/OrdersUncheckedCreateInput.schema';

export const OrdersCreateOneSchema = z.object({
  data: z.union([
    OrdersCreateInputObjectSchema,
    OrdersUncheckedCreateInputObjectSchema,
  ]),
});
