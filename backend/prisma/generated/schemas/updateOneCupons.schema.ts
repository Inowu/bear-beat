import { z } from 'zod';
import { CuponsUpdateInputObjectSchema } from './objects/CuponsUpdateInput.schema';
import { CuponsUncheckedUpdateInputObjectSchema } from './objects/CuponsUncheckedUpdateInput.schema';
import { CuponsWhereUniqueInputObjectSchema } from './objects/CuponsWhereUniqueInput.schema';

export const CuponsUpdateOneSchema = z.object({
  data: z.union([
    CuponsUpdateInputObjectSchema,
    CuponsUncheckedUpdateInputObjectSchema,
  ]),
  where: CuponsWhereUniqueInputObjectSchema,
});
