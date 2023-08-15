import { z } from 'zod';
import { CuponsUsedCreateManyInputObjectSchema } from './objects/CuponsUsedCreateManyInput.schema';

export const CuponsUsedCreateManySchema = z.object({
  data: z.union([
    CuponsUsedCreateManyInputObjectSchema,
    z.array(CuponsUsedCreateManyInputObjectSchema),
  ]),
  skipDuplicates: z.boolean().optional(),
});
