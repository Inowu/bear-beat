import { z } from 'zod';
import { OrdersCreateManyInputObjectSchema } from './objects/OrdersCreateManyInput.schema';

export const OrdersCreateManySchema = z.object({
  data: z.union([
    OrdersCreateManyInputObjectSchema,
    z.array(OrdersCreateManyInputObjectSchema),
  ]),
  skipDuplicates: z.boolean().optional(),
});
