import { z } from 'zod';
import { PlansSelectObjectSchema } from './objects/PlansSelect.schema';
import { PlansUpdateInputObjectSchema } from './objects/PlansUpdateInput.schema';
import { PlansUncheckedUpdateInputObjectSchema } from './objects/PlansUncheckedUpdateInput.schema';
import { PlansWhereUniqueInputObjectSchema } from './objects/PlansWhereUniqueInput.schema';

export const PlansUpdateOneSchema = z.object({
  select: PlansSelectObjectSchema.optional(),
  data: z.union([
    PlansUpdateInputObjectSchema,
    PlansUncheckedUpdateInputObjectSchema,
  ]),
  where: PlansWhereUniqueInputObjectSchema,
});
