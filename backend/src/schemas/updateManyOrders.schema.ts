import { z } from 'zod';
import { OrdersUpdateManyMutationInputObjectSchema } from './objects/OrdersUpdateManyMutationInput.schema';
import { OrdersWhereInputObjectSchema } from './objects/OrdersWhereInput.schema';

export const OrdersUpdateManySchema = z.object({
  data: OrdersUpdateManyMutationInputObjectSchema,
  where: OrdersWhereInputObjectSchema.optional(),
});
