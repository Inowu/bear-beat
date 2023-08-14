import { z } from 'zod';
import { CuponsSelectObjectSchema } from './objects/CuponsSelect.schema';
import { CuponsWhereUniqueInputObjectSchema } from './objects/CuponsWhereUniqueInput.schema';

export const CuponsFindUniqueSchema = z.object({
  select: CuponsSelectObjectSchema.optional(),
  where: CuponsWhereUniqueInputObjectSchema,
});
