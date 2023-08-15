import { z } from 'zod';
import { DescargasUserWhereInputObjectSchema } from './objects/DescargasUserWhereInput.schema';
import { DescargasUserOrderByWithAggregationInputObjectSchema } from './objects/DescargasUserOrderByWithAggregationInput.schema';
import { DescargasUserScalarWhereWithAggregatesInputObjectSchema } from './objects/DescargasUserScalarWhereWithAggregatesInput.schema';
import { DescargasUserScalarFieldEnumSchema } from './enums/DescargasUserScalarFieldEnum.schema';

export const DescargasUserGroupBySchema = z.object({
  where: DescargasUserWhereInputObjectSchema.optional(),
  orderBy: z
    .union([
      DescargasUserOrderByWithAggregationInputObjectSchema,
      DescargasUserOrderByWithAggregationInputObjectSchema.array(),
    ])
    .optional(),
  having: DescargasUserScalarWhereWithAggregatesInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  by: z.array(DescargasUserScalarFieldEnumSchema),
});
