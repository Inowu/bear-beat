import { z } from 'zod';
import { ConfigWhereInputObjectSchema } from './objects/ConfigWhereInput.schema';
import { ConfigOrderByWithAggregationInputObjectSchema } from './objects/ConfigOrderByWithAggregationInput.schema';
import { ConfigScalarWhereWithAggregatesInputObjectSchema } from './objects/ConfigScalarWhereWithAggregatesInput.schema';
import { ConfigScalarFieldEnumSchema } from './enums/ConfigScalarFieldEnum.schema';

export const ConfigGroupBySchema = z.object({
  where: ConfigWhereInputObjectSchema.optional(),
  orderBy: z
    .union([
      ConfigOrderByWithAggregationInputObjectSchema,
      ConfigOrderByWithAggregationInputObjectSchema.array(),
    ])
    .optional(),
  having: ConfigScalarWhereWithAggregatesInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  by: z.array(ConfigScalarFieldEnumSchema),
});
