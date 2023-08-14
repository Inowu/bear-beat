import { z } from 'zod';
import { UserFilesWhereInputObjectSchema } from './objects/UserFilesWhereInput.schema';
import { UserFilesOrderByWithAggregationInputObjectSchema } from './objects/UserFilesOrderByWithAggregationInput.schema';
import { UserFilesScalarWhereWithAggregatesInputObjectSchema } from './objects/UserFilesScalarWhereWithAggregatesInput.schema';
import { UserFilesScalarFieldEnumSchema } from './enums/UserFilesScalarFieldEnum.schema';

export const UserFilesGroupBySchema = z.object({
  where: UserFilesWhereInputObjectSchema.optional(),
  orderBy: z
    .union([
      UserFilesOrderByWithAggregationInputObjectSchema,
      UserFilesOrderByWithAggregationInputObjectSchema.array(),
    ])
    .optional(),
  having: UserFilesScalarWhereWithAggregatesInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  by: z.array(UserFilesScalarFieldEnumSchema),
});
