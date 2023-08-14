import { z } from 'zod';
import { PlansCreateManyInputObjectSchema } from './objects/PlansCreateManyInput.schema';

export const PlansCreateManySchema = z.object({
  data: z.union([
    PlansCreateManyInputObjectSchema,
    z.array(PlansCreateManyInputObjectSchema),
  ]),
  skipDuplicates: z.boolean().optional(),
});
