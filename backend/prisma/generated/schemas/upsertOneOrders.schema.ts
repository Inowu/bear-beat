import { z } from 'zod';
import { OrdersWhereUniqueInputObjectSchema } from './objects/OrdersWhereUniqueInput.schema';
import { OrdersCreateInputObjectSchema } from './objects/OrdersCreateInput.schema';
import { OrdersUncheckedCreateInputObjectSchema } from './objects/OrdersUncheckedCreateInput.schema';
import { OrdersUpdateInputObjectSchema } from './objects/OrdersUpdateInput.schema';
import { OrdersUncheckedUpdateInputObjectSchema } from './objects/OrdersUncheckedUpdateInput.schema';

export const OrdersUpsertSchema = z.object({
  where: OrdersWhereUniqueInputObjectSchema,
  create: z.union([
    OrdersCreateInputObjectSchema,
    OrdersUncheckedCreateInputObjectSchema,
  ]),
  update: z.union([
    OrdersUpdateInputObjectSchema,
    OrdersUncheckedUpdateInputObjectSchema,
  ]),
});
