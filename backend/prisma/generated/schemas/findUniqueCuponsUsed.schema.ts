import { z } from 'zod';
import { CuponsUsedWhereUniqueInputObjectSchema } from './objects/CuponsUsedWhereUniqueInput.schema';

export const CuponsUsedFindUniqueSchema = z.object({
  where: CuponsUsedWhereUniqueInputObjectSchema,
});
