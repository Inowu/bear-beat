import { z } from 'zod';
import { PlansWhereInputObjectSchema } from './objects/PlansWhereInput.schema';

export const PlansDeleteManySchema = z.object({
  where: PlansWhereInputObjectSchema.optional(),
});
