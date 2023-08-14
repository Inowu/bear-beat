import { z } from 'zod';
import { CuponsSelectObjectSchema } from './objects/CuponsSelect.schema';
import { CuponsCreateInputObjectSchema } from './objects/CuponsCreateInput.schema';
import { CuponsUncheckedCreateInputObjectSchema } from './objects/CuponsUncheckedCreateInput.schema';

export const CuponsCreateOneSchema = z.object({
  select: CuponsSelectObjectSchema.optional(),
  data: z.union([
    CuponsCreateInputObjectSchema,
    CuponsUncheckedCreateInputObjectSchema,
  ]),
});
