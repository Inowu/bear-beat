import { z } from 'zod';
import { PlansSelectObjectSchema } from './objects/PlansSelect.schema';
import { PlansWhereUniqueInputObjectSchema } from './objects/PlansWhereUniqueInput.schema';

export const PlansFindUniqueSchema = z.object({
  select: PlansSelectObjectSchema.optional(),
  where: PlansWhereUniqueInputObjectSchema,
});
