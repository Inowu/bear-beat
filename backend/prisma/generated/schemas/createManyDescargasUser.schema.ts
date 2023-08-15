import { z } from 'zod';
import { DescargasUserCreateManyInputObjectSchema } from './objects/DescargasUserCreateManyInput.schema';

export const DescargasUserCreateManySchema = z.object({
  data: z.union([
    DescargasUserCreateManyInputObjectSchema,
    z.array(DescargasUserCreateManyInputObjectSchema),
  ]),
  skipDuplicates: z.boolean().optional(),
});
