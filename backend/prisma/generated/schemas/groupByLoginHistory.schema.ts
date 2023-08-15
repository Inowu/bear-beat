import { z } from 'zod';
import { LoginHistoryWhereInputObjectSchema } from './objects/LoginHistoryWhereInput.schema';
import { LoginHistoryOrderByWithAggregationInputObjectSchema } from './objects/LoginHistoryOrderByWithAggregationInput.schema';
import { LoginHistoryScalarWhereWithAggregatesInputObjectSchema } from './objects/LoginHistoryScalarWhereWithAggregatesInput.schema';
import { LoginHistoryScalarFieldEnumSchema } from './enums/LoginHistoryScalarFieldEnum.schema';

export const LoginHistoryGroupBySchema = z.object({
  where: LoginHistoryWhereInputObjectSchema.optional(),
  orderBy: z
    .union([
      LoginHistoryOrderByWithAggregationInputObjectSchema,
      LoginHistoryOrderByWithAggregationInputObjectSchema.array(),
    ])
    .optional(),
  having: LoginHistoryScalarWhereWithAggregatesInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  by: z.array(LoginHistoryScalarFieldEnumSchema),
});
