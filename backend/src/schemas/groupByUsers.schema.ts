import { z } from 'zod';
import { UsersWhereInputObjectSchema } from './objects/UsersWhereInput.schema';
import { UsersOrderByWithAggregationInputObjectSchema } from './objects/UsersOrderByWithAggregationInput.schema';
import { UsersScalarWhereWithAggregatesInputObjectSchema } from './objects/UsersScalarWhereWithAggregatesInput.schema';
import { UsersScalarFieldEnumSchema } from './enums/UsersScalarFieldEnum.schema';

export const UsersGroupBySchema = z.object({
  where: UsersWhereInputObjectSchema.optional(),
  orderBy: z
    .union([
      UsersOrderByWithAggregationInputObjectSchema,
      UsersOrderByWithAggregationInputObjectSchema.array(),
    ])
    .optional(),
  having: UsersScalarWhereWithAggregatesInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  by: z.array(UsersScalarFieldEnumSchema),
});
