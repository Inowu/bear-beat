import { z } from 'zod';
import { RolesWhereInputObjectSchema } from './objects/RolesWhereInput.schema';
import { RolesOrderByWithAggregationInputObjectSchema } from './objects/RolesOrderByWithAggregationInput.schema';
import { RolesScalarWhereWithAggregatesInputObjectSchema } from './objects/RolesScalarWhereWithAggregatesInput.schema';
import { RolesScalarFieldEnumSchema } from './enums/RolesScalarFieldEnum.schema';

export const RolesGroupBySchema = z.object({
  where: RolesWhereInputObjectSchema.optional(),
  orderBy: z
    .union([
      RolesOrderByWithAggregationInputObjectSchema,
      RolesOrderByWithAggregationInputObjectSchema.array(),
    ])
    .optional(),
  having: RolesScalarWhereWithAggregatesInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  by: z.array(RolesScalarFieldEnumSchema),
});
