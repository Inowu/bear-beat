import { z } from 'zod';
import { CuponsSelectObjectSchema } from './objects/CuponsSelect.schema';
import { CuponsUpdateInputObjectSchema } from './objects/CuponsUpdateInput.schema';
import { CuponsUncheckedUpdateInputObjectSchema } from './objects/CuponsUncheckedUpdateInput.schema';
import { CuponsWhereUniqueInputObjectSchema } from './objects/CuponsWhereUniqueInput.schema';

export const CuponsUpdateOneSchema = z.object({
  select: CuponsSelectObjectSchema.optional(),
  data: z.union([
    CuponsUpdateInputObjectSchema,
    CuponsUncheckedUpdateInputObjectSchema,
  ]),
  where: CuponsWhereUniqueInputObjectSchema,
});
