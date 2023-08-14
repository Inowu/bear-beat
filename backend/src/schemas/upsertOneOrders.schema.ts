import { z } from 'zod';
import { OrdersSelectObjectSchema } from './objects/OrdersSelect.schema';
import { OrdersWhereUniqueInputObjectSchema } from './objects/OrdersWhereUniqueInput.schema';
import { OrdersCreateInputObjectSchema } from './objects/OrdersCreateInput.schema';
import { OrdersUncheckedCreateInputObjectSchema } from './objects/OrdersUncheckedCreateInput.schema';
import { OrdersUpdateInputObjectSchema } from './objects/OrdersUpdateInput.schema';
import { OrdersUncheckedUpdateInputObjectSchema } from './objects/OrdersUncheckedUpdateInput.schema';

export const OrdersUpsertSchema = z.object({
  select: OrdersSelectObjectSchema.optional(),
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
