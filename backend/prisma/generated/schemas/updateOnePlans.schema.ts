import { z } from 'zod';
import { PlansUpdateInputObjectSchema } from './objects/PlansUpdateInput.schema';
import { PlansUncheckedUpdateInputObjectSchema } from './objects/PlansUncheckedUpdateInput.schema';
import { PlansWhereUniqueInputObjectSchema } from './objects/PlansWhereUniqueInput.schema';

export const PlansUpdateOneSchema = z.object({
  data: z.union([
    PlansUpdateInputObjectSchema,
    PlansUncheckedUpdateInputObjectSchema,
  ]),
  where: PlansWhereUniqueInputObjectSchema,
});
