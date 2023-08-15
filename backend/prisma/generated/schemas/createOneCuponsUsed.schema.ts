import { z } from 'zod';
import { CuponsUsedCreateInputObjectSchema } from './objects/CuponsUsedCreateInput.schema';
import { CuponsUsedUncheckedCreateInputObjectSchema } from './objects/CuponsUsedUncheckedCreateInput.schema';

export const CuponsUsedCreateOneSchema = z.object({
  data: z.union([
    CuponsUsedCreateInputObjectSchema,
    CuponsUsedUncheckedCreateInputObjectSchema,
  ]),
});
