import { z } from 'zod';
import { CuponsUsedSelectObjectSchema } from './objects/CuponsUsedSelect.schema';
import { CuponsUsedUpdateInputObjectSchema } from './objects/CuponsUsedUpdateInput.schema';
import { CuponsUsedUncheckedUpdateInputObjectSchema } from './objects/CuponsUsedUncheckedUpdateInput.schema';
import { CuponsUsedWhereUniqueInputObjectSchema } from './objects/CuponsUsedWhereUniqueInput.schema';

export const CuponsUsedUpdateOneSchema = z.object({
  select: CuponsUsedSelectObjectSchema.optional(),
  data: z.union([
    CuponsUsedUpdateInputObjectSchema,
    CuponsUsedUncheckedUpdateInputObjectSchema,
  ]),
  where: CuponsUsedWhereUniqueInputObjectSchema,
});
