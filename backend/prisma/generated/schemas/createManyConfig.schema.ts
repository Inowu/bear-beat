import { z } from 'zod';
import { ConfigCreateManyInputObjectSchema } from './objects/ConfigCreateManyInput.schema';

export const ConfigCreateManySchema = z.object({
  data: z.union([
    ConfigCreateManyInputObjectSchema,
    z.array(ConfigCreateManyInputObjectSchema),
  ]),
  skipDuplicates: z.boolean().optional(),
});
