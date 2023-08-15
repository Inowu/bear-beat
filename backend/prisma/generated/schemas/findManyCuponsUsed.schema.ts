import { z } from 'zod';
import { CuponsUsedOrderByWithRelationInputObjectSchema } from './objects/CuponsUsedOrderByWithRelationInput.schema';
import { CuponsUsedWhereInputObjectSchema } from './objects/CuponsUsedWhereInput.schema';
import { CuponsUsedWhereUniqueInputObjectSchema } from './objects/CuponsUsedWhereUniqueInput.schema';
import { CuponsUsedScalarFieldEnumSchema } from './enums/CuponsUsedScalarFieldEnum.schema';

export const CuponsUsedFindManySchema = z.object({
  orderBy: z
    .union([
      CuponsUsedOrderByWithRelationInputObjectSchema,
      CuponsUsedOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: CuponsUsedWhereInputObjectSchema.optional(),
  cursor: CuponsUsedWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.array(CuponsUsedScalarFieldEnumSchema).optional(),
});
