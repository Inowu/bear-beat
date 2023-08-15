import { z } from 'zod';
import { DescargasUserOrderByWithRelationInputObjectSchema } from './objects/DescargasUserOrderByWithRelationInput.schema';
import { DescargasUserWhereInputObjectSchema } from './objects/DescargasUserWhereInput.schema';
import { DescargasUserWhereUniqueInputObjectSchema } from './objects/DescargasUserWhereUniqueInput.schema';
import { DescargasUserScalarFieldEnumSchema } from './enums/DescargasUserScalarFieldEnum.schema';

export const DescargasUserFindManySchema = z.object({
  orderBy: z
    .union([
      DescargasUserOrderByWithRelationInputObjectSchema,
      DescargasUserOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: DescargasUserWhereInputObjectSchema.optional(),
  cursor: DescargasUserWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.array(DescargasUserScalarFieldEnumSchema).optional(),
});
