import { z } from 'zod';
import { CuponsUsedUpdateManyMutationInputObjectSchema } from './objects/CuponsUsedUpdateManyMutationInput.schema';
import { CuponsUsedWhereInputObjectSchema } from './objects/CuponsUsedWhereInput.schema';

export const CuponsUsedUpdateManySchema = z.object({
  data: CuponsUsedUpdateManyMutationInputObjectSchema,
  where: CuponsUsedWhereInputObjectSchema.optional(),
});
