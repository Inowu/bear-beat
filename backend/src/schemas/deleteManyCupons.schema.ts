import { z } from 'zod';
import { CuponsWhereInputObjectSchema } from './objects/CuponsWhereInput.schema';

export const CuponsDeleteManySchema = z.object({
  where: CuponsWhereInputObjectSchema.optional(),
});
