import { z } from 'zod';
import { CuponsUsedWhereUniqueInputObjectSchema } from './objects/CuponsUsedWhereUniqueInput.schema';

export const CuponsUsedDeleteOneSchema = z.object({
  where: CuponsUsedWhereUniqueInputObjectSchema,
});
