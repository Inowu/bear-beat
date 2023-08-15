import { z } from 'zod';
import { CuponsWhereUniqueInputObjectSchema } from './objects/CuponsWhereUniqueInput.schema';
import { CuponsCreateInputObjectSchema } from './objects/CuponsCreateInput.schema';
import { CuponsUncheckedCreateInputObjectSchema } from './objects/CuponsUncheckedCreateInput.schema';
import { CuponsUpdateInputObjectSchema } from './objects/CuponsUpdateInput.schema';
import { CuponsUncheckedUpdateInputObjectSchema } from './objects/CuponsUncheckedUpdateInput.schema';

export const CuponsUpsertSchema = z.object({
  where: CuponsWhereUniqueInputObjectSchema,
  create: z.union([
    CuponsCreateInputObjectSchema,
    CuponsUncheckedCreateInputObjectSchema,
  ]),
  update: z.union([
    CuponsUpdateInputObjectSchema,
    CuponsUncheckedUpdateInputObjectSchema,
  ]),
});
