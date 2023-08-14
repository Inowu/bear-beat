import { z } from 'zod';
import { CuponsSelectObjectSchema } from './objects/CuponsSelect.schema';
import { CuponsOrderByWithRelationInputObjectSchema } from './objects/CuponsOrderByWithRelationInput.schema';
import { CuponsWhereInputObjectSchema } from './objects/CuponsWhereInput.schema';
import { CuponsWhereUniqueInputObjectSchema } from './objects/CuponsWhereUniqueInput.schema';
import { CuponsScalarFieldEnumSchema } from './enums/CuponsScalarFieldEnum.schema';

export const CuponsFindManySchema = z.object({
  select: z.lazy(() => CuponsSelectObjectSchema.optional()),
  orderBy: z
    .union([
      CuponsOrderByWithRelationInputObjectSchema,
      CuponsOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: CuponsWhereInputObjectSchema.optional(),
  cursor: CuponsWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.array(CuponsScalarFieldEnumSchema).optional(),
});
