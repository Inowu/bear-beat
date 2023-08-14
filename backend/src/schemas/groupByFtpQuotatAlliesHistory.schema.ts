import { z } from 'zod';
import { FtpQuotatAlliesHistoryWhereInputObjectSchema } from './objects/FtpQuotatAlliesHistoryWhereInput.schema';
import { FtpQuotatAlliesHistoryOrderByWithAggregationInputObjectSchema } from './objects/FtpQuotatAlliesHistoryOrderByWithAggregationInput.schema';
import { FtpQuotatAlliesHistoryScalarWhereWithAggregatesInputObjectSchema } from './objects/FtpQuotatAlliesHistoryScalarWhereWithAggregatesInput.schema';
import { FtpQuotatAlliesHistoryScalarFieldEnumSchema } from './enums/FtpQuotatAlliesHistoryScalarFieldEnum.schema';

export const FtpQuotatAlliesHistoryGroupBySchema = z.object({
  where: FtpQuotatAlliesHistoryWhereInputObjectSchema.optional(),
  orderBy: z
    .union([
      FtpQuotatAlliesHistoryOrderByWithAggregationInputObjectSchema,
      FtpQuotatAlliesHistoryOrderByWithAggregationInputObjectSchema.array(),
    ])
    .optional(),
  having:
    FtpQuotatAlliesHistoryScalarWhereWithAggregatesInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  by: z.array(FtpQuotatAlliesHistoryScalarFieldEnumSchema),
});
