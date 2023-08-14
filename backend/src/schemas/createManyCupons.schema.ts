import { z } from 'zod';
import { CuponsCreateManyInputObjectSchema } from './objects/CuponsCreateManyInput.schema';

export const CuponsCreateManySchema = z.object({
  data: z.union([
    CuponsCreateManyInputObjectSchema,
    z.array(CuponsCreateManyInputObjectSchema),
  ]),
  skipDuplicates: z.boolean().optional(),
});
