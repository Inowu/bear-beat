import { z } from 'zod';
import { PlansSelectObjectSchema } from './objects/PlansSelect.schema';
import { PlansCreateInputObjectSchema } from './objects/PlansCreateInput.schema';
import { PlansUncheckedCreateInputObjectSchema } from './objects/PlansUncheckedCreateInput.schema';

export const PlansCreateOneSchema = z.object({
  select: PlansSelectObjectSchema.optional(),
  data: z.union([
    PlansCreateInputObjectSchema,
    PlansUncheckedCreateInputObjectSchema,
  ]),
});
