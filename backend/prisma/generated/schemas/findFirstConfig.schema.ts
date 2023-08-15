import { z } from 'zod';
import { ConfigOrderByWithRelationInputObjectSchema } from './objects/ConfigOrderByWithRelationInput.schema';
import { ConfigWhereInputObjectSchema } from './objects/ConfigWhereInput.schema';
import { ConfigWhereUniqueInputObjectSchema } from './objects/ConfigWhereUniqueInput.schema';
import { ConfigScalarFieldEnumSchema } from './enums/ConfigScalarFieldEnum.schema';

export const ConfigFindFirstSchema = z.object({
  orderBy: z
    .union([
      ConfigOrderByWithRelationInputObjectSchema,
      ConfigOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: ConfigWhereInputObjectSchema.optional(),
  cursor: ConfigWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.array(ConfigScalarFieldEnumSchema).optional(),
});
