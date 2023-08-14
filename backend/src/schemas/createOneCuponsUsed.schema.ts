import { z } from 'zod';
import { CuponsUsedSelectObjectSchema } from './objects/CuponsUsedSelect.schema';
import { CuponsUsedCreateInputObjectSchema } from './objects/CuponsUsedCreateInput.schema';
import { CuponsUsedUncheckedCreateInputObjectSchema } from './objects/CuponsUsedUncheckedCreateInput.schema';

export const CuponsUsedCreateOneSchema = z.object({
  select: CuponsUsedSelectObjectSchema.optional(),
  data: z.union([
    CuponsUsedCreateInputObjectSchema,
    CuponsUsedUncheckedCreateInputObjectSchema,
  ]),
});
