import { z } from 'zod';
import { DescargasUserSelectObjectSchema } from './objects/DescargasUserSelect.schema';
import { DescargasUserOrderByWithRelationInputObjectSchema } from './objects/DescargasUserOrderByWithRelationInput.schema';
import { DescargasUserWhereInputObjectSchema } from './objects/DescargasUserWhereInput.schema';
import { DescargasUserWhereUniqueInputObjectSchema } from './objects/DescargasUserWhereUniqueInput.schema';
import { DescargasUserScalarFieldEnumSchema } from './enums/DescargasUserScalarFieldEnum.schema';

export const DescargasUserFindFirstSchema = z.object({
  select: DescargasUserSelectObjectSchema.optional(),
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
