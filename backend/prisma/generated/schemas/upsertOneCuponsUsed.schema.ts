import { z } from 'zod';
import { CuponsUsedWhereUniqueInputObjectSchema } from './objects/CuponsUsedWhereUniqueInput.schema';
import { CuponsUsedCreateInputObjectSchema } from './objects/CuponsUsedCreateInput.schema';
import { CuponsUsedUncheckedCreateInputObjectSchema } from './objects/CuponsUsedUncheckedCreateInput.schema';
import { CuponsUsedUpdateInputObjectSchema } from './objects/CuponsUsedUpdateInput.schema';
import { CuponsUsedUncheckedUpdateInputObjectSchema } from './objects/CuponsUsedUncheckedUpdateInput.schema';

export const CuponsUsedUpsertSchema = z.object({
  where: CuponsUsedWhereUniqueInputObjectSchema,
  create: z.union([
    CuponsUsedCreateInputObjectSchema,
    CuponsUsedUncheckedCreateInputObjectSchema,
  ]),
  update: z.union([
    CuponsUsedUpdateInputObjectSchema,
    CuponsUsedUncheckedUpdateInputObjectSchema,
  ]),
});
