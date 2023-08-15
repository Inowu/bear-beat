import { z } from 'zod';
import { CuponsWhereUniqueInputObjectSchema } from './objects/CuponsWhereUniqueInput.schema';

export const CuponsFindUniqueSchema = z.object({
  where: CuponsWhereUniqueInputObjectSchema,
});
