import { z } from 'zod';
import { CuponsUsedWhereInputObjectSchema } from './objects/CuponsUsedWhereInput.schema';

export const CuponsUsedDeleteManySchema = z.object({
  where: CuponsUsedWhereInputObjectSchema.optional(),
});
