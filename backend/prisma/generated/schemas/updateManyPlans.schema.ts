import { z } from 'zod';
import { PlansUpdateManyMutationInputObjectSchema } from './objects/PlansUpdateManyMutationInput.schema';
import { PlansWhereInputObjectSchema } from './objects/PlansWhereInput.schema';

export const PlansUpdateManySchema = z.object({
  data: PlansUpdateManyMutationInputObjectSchema,
  where: PlansWhereInputObjectSchema.optional(),
});
