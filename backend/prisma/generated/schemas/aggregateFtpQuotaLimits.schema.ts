import { z } from 'zod';
import { FtpQuotaLimitsOrderByWithRelationInputObjectSchema } from './objects/FtpQuotaLimitsOrderByWithRelationInput.schema';
import { FtpQuotaLimitsWhereInputObjectSchema } from './objects/FtpQuotaLimitsWhereInput.schema';
import { FtpQuotaLimitsWhereUniqueInputObjectSchema } from './objects/FtpQuotaLimitsWhereUniqueInput.schema';
import { FtpQuotaLimitsCountAggregateInputObjectSchema } from './objects/FtpQuotaLimitsCountAggregateInput.schema';
import { FtpQuotaLimitsMinAggregateInputObjectSchema } from './objects/FtpQuotaLimitsMinAggregateInput.schema';
import { FtpQuotaLimitsMaxAggregateInputObjectSchema } from './objects/FtpQuotaLimitsMaxAggregateInput.schema';
import { FtpQuotaLimitsAvgAggregateInputObjectSchema } from './objects/FtpQuotaLimitsAvgAggregateInput.schema';
import { FtpQuotaLimitsSumAggregateInputObjectSchema } from './objects/FtpQuotaLimitsSumAggregateInput.schema';

export const FtpQuotaLimitsAggregateSchema = z.object({
  orderBy: z
    .union([
      FtpQuotaLimitsOrderByWithRelationInputObjectSchema,
      FtpQuotaLimitsOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: FtpQuotaLimitsWhereInputObjectSchema.optional(),
  cursor: FtpQuotaLimitsWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  _count: z
    .union([z.literal(true), FtpQuotaLimitsCountAggregateInputObjectSchema])
    .optional(),
  _min: FtpQuotaLimitsMinAggregateInputObjectSchema.optional(),
  _max: FtpQuotaLimitsMaxAggregateInputObjectSchema.optional(),
  _avg: FtpQuotaLimitsAvgAggregateInputObjectSchema.optional(),
  _sum: FtpQuotaLimitsSumAggregateInputObjectSchema.optional(),
});
