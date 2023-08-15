import { z } from 'zod';
import { CuponsUsedUpdateInputObjectSchema } from './objects/CuponsUsedUpdateInput.schema';
import { CuponsUsedUncheckedUpdateInputObjectSchema } from './objects/CuponsUsedUncheckedUpdateInput.schema';
import { CuponsUsedWhereUniqueInputObjectSchema } from './objects/CuponsUsedWhereUniqueInput.schema';

export const CuponsUsedUpdateOneSchema = z.object({
  data: z.union([
    CuponsUsedUpdateInputObjectSchema,
    CuponsUsedUncheckedUpdateInputObjectSchema,
  ]),
  where: CuponsUsedWhereUniqueInputObjectSchema,
});
