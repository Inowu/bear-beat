import { z } from 'zod';
import { RolesCreateManyInputObjectSchema } from './objects/RolesCreateManyInput.schema';

export const RolesCreateManySchema = z.object({
  data: z.union([
    RolesCreateManyInputObjectSchema,
    z.array(RolesCreateManyInputObjectSchema),
  ]),
  skipDuplicates: z.boolean().optional(),
});
