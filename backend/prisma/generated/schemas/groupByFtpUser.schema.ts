import { z } from 'zod';
import { FtpUserWhereInputObjectSchema } from './objects/FtpUserWhereInput.schema';
import { FtpUserOrderByWithAggregationInputObjectSchema } from './objects/FtpUserOrderByWithAggregationInput.schema';
import { FtpUserScalarWhereWithAggregatesInputObjectSchema } from './objects/FtpUserScalarWhereWithAggregatesInput.schema';
import { FtpUserScalarFieldEnumSchema } from './enums/FtpUserScalarFieldEnum.schema';

export const FtpUserGroupBySchema = z.object({
  where: FtpUserWhereInputObjectSchema.optional(),
  orderBy: z
    .union([
      FtpUserOrderByWithAggregationInputObjectSchema,
      FtpUserOrderByWithAggregationInputObjectSchema.array(),
    ])
    .optional(),
  having: FtpUserScalarWhereWithAggregatesInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  by: z.array(FtpUserScalarFieldEnumSchema),
});
