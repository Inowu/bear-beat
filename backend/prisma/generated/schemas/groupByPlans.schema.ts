import { z } from 'zod';
import { PlansWhereInputObjectSchema } from './objects/PlansWhereInput.schema';
import { PlansOrderByWithAggregationInputObjectSchema } from './objects/PlansOrderByWithAggregationInput.schema';
import { PlansScalarWhereWithAggregatesInputObjectSchema } from './objects/PlansScalarWhereWithAggregatesInput.schema';
import { PlansScalarFieldEnumSchema } from './enums/PlansScalarFieldEnum.schema';

export const PlansGroupBySchema = z.object({
  where: PlansWhereInputObjectSchema.optional(),
  orderBy: z
    .union([
      PlansOrderByWithAggregationInputObjectSchema,
      PlansOrderByWithAggregationInputObjectSchema.array(),
    ])
    .optional(),
  having: PlansScalarWhereWithAggregatesInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  by: z.array(PlansScalarFieldEnumSchema),
});
