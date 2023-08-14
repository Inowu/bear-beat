import { z } from 'zod';
import { OrdersSelectObjectSchema } from './objects/OrdersSelect.schema';
import { OrdersUpdateInputObjectSchema } from './objects/OrdersUpdateInput.schema';
import { OrdersUncheckedUpdateInputObjectSchema } from './objects/OrdersUncheckedUpdateInput.schema';
import { OrdersWhereUniqueInputObjectSchema } from './objects/OrdersWhereUniqueInput.schema';

export const OrdersUpdateOneSchema = z.object({
  select: OrdersSelectObjectSchema.optional(),
  data: z.union([
    OrdersUpdateInputObjectSchema,
    OrdersUncheckedUpdateInputObjectSchema,
  ]),
  where: OrdersWhereUniqueInputObjectSchema,
});
