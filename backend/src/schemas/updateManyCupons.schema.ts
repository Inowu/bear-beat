import { z } from 'zod';
import { CuponsUpdateManyMutationInputObjectSchema } from './objects/CuponsUpdateManyMutationInput.schema';
import { CuponsWhereInputObjectSchema } from './objects/CuponsWhereInput.schema';

export const CuponsUpdateManySchema = z.object({
  data: CuponsUpdateManyMutationInputObjectSchema,
  where: CuponsWhereInputObjectSchema.optional(),
});
