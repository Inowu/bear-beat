import { z } from 'zod';
import { FtpQuotaLimitsWhereInputObjectSchema } from './objects/FtpQuotaLimitsWhereInput.schema';
import { FtpQuotaLimitsOrderByWithAggregationInputObjectSchema } from './objects/FtpQuotaLimitsOrderByWithAggregationInput.schema';
import { FtpQuotaLimitsScalarWhereWithAggregatesInputObjectSchema } from './objects/FtpQuotaLimitsScalarWhereWithAggregatesInput.schema';
import { FtpQuotaLimitsScalarFieldEnumSchema } from './enums/FtpQuotaLimitsScalarFieldEnum.schema';

export const FtpQuotaLimitsGroupBySchema = z.object({
  where: FtpQuotaLimitsWhereInputObjectSchema.optional(),
  orderBy: z
    .union([
      FtpQuotaLimitsOrderByWithAggregationInputObjectSchema,
      FtpQuotaLimitsOrderByWithAggregationInputObjectSchema.array(),
    ])
    .optional(),
  having: FtpQuotaLimitsScalarWhereWithAggregatesInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  by: z.array(FtpQuotaLimitsScalarFieldEnumSchema),
});
