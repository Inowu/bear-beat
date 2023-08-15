import { z } from 'zod';
import { PlansWhereUniqueInputObjectSchema } from './objects/PlansWhereUniqueInput.schema';

export const PlansDeleteOneSchema = z.object({
  where: PlansWhereUniqueInputObjectSchema,
});
