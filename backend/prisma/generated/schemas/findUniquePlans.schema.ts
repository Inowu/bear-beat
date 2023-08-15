import { z } from 'zod';
import { PlansWhereUniqueInputObjectSchema } from './objects/PlansWhereUniqueInput.schema';

export const PlansFindUniqueSchema = z.object({
  where: PlansWhereUniqueInputObjectSchema,
});
