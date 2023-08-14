import { z } from 'zod';
import { CuponsUsedSelectObjectSchema } from './objects/CuponsUsedSelect.schema';
import { CuponsUsedWhereUniqueInputObjectSchema } from './objects/CuponsUsedWhereUniqueInput.schema';

export const CuponsUsedFindUniqueSchema = z.object({
  select: CuponsUsedSelectObjectSchema.optional(),
  where: CuponsUsedWhereUniqueInputObjectSchema,
});
