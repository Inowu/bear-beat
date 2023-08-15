import { z } from 'zod';
import { FtpQuotaTalliesHistoryWhereInputObjectSchema } from './objects/FtpQuotaTalliesHistoryWhereInput.schema';
import { FtpQuotaTalliesHistoryOrderByWithAggregationInputObjectSchema } from './objects/FtpQuotaTalliesHistoryOrderByWithAggregationInput.schema';
import { FtpQuotaTalliesHistoryScalarWhereWithAggregatesInputObjectSchema } from './objects/FtpQuotaTalliesHistoryScalarWhereWithAggregatesInput.schema';
import { FtpQuotaTalliesHistoryScalarFieldEnumSchema } from './enums/FtpQuotaTalliesHistoryScalarFieldEnum.schema';

export const FtpQuotaTalliesHistoryGroupBySchema = z.object({
  where: FtpQuotaTalliesHistoryWhereInputObjectSchema.optional(),
  orderBy: z
    .union([
      FtpQuotaTalliesHistoryOrderByWithAggregationInputObjectSchema,
      FtpQuotaTalliesHistoryOrderByWithAggregationInputObjectSchema.array(),
    ])
    .optional(),
  having:
    FtpQuotaTalliesHistoryScalarWhereWithAggregatesInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  by: z.array(FtpQuotaTalliesHistoryScalarFieldEnumSchema),
});
