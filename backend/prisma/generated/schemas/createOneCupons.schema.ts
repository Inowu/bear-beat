import { z } from 'zod';
import { CuponsCreateInputObjectSchema } from './objects/CuponsCreateInput.schema';
import { CuponsUncheckedCreateInputObjectSchema } from './objects/CuponsUncheckedCreateInput.schema';

export const CuponsCreateOneSchema = z.object({
  data: z.union([
    CuponsCreateInputObjectSchema,
    CuponsUncheckedCreateInputObjectSchema,
  ]),
});
