import { z } from 'zod';
import { PlansCreateInputObjectSchema } from './objects/PlansCreateInput.schema';
import { PlansUncheckedCreateInputObjectSchema } from './objects/PlansUncheckedCreateInput.schema';

export const PlansCreateOneSchema = z.object({
  data: z.union([
    PlansCreateInputObjectSchema,
    PlansUncheckedCreateInputObjectSchema,
  ]),
});
