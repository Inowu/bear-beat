import { z } from 'zod';
import { FtpQuotatAlliesHistoryOrderByWithRelationInputObjectSchema } from './objects/FtpQuotatAlliesHistoryOrderByWithRelationInput.schema';
import { FtpQuotatAlliesHistoryWhereInputObjectSchema } from './objects/FtpQuotatAlliesHistoryWhereInput.schema';
import { FtpQuotatAlliesHistoryWhereUniqueInputObjectSchema } from './objects/FtpQuotatAlliesHistoryWhereUniqueInput.schema';
import { FtpQuotatAlliesHistoryCountAggregateInputObjectSchema } from './objects/FtpQuotatAlliesHistoryCountAggregateInput.schema';
import { FtpQuotatAlliesHistoryMinAggregateInputObjectSchema } from './objects/FtpQuotatAlliesHistoryMinAggregateInput.schema';
import { FtpQuotatAlliesHistoryMaxAggregateInputObjectSchema } from './objects/FtpQuotatAlliesHistoryMaxAggregateInput.schema';
import { FtpQuotatAlliesHistoryAvgAggregateInputObjectSchema } from './objects/FtpQuotatAlliesHistoryAvgAggregateInput.schema';
import { FtpQuotatAlliesHistorySumAggregateInputObjectSchema } from './objects/FtpQuotatAlliesHistorySumAggregateInput.schema';

export const FtpQuotatAlliesHistoryAggregateSchema = z.object({
  orderBy: z
    .union([
      FtpQuotatAlliesHistoryOrderByWithRelationInputObjectSchema,
      FtpQuotatAlliesHistoryOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: FtpQuotatAlliesHistoryWhereInputObjectSchema.optional(),
  cursor: FtpQuotatAlliesHistoryWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  _count: z
    .union([
      z.literal(true),
      FtpQuotatAlliesHistoryCountAggregateInputObjectSchema,
    ])
    .optional(),
  _min: FtpQuotatAlliesHistoryMinAggregateInputObjectSchema.optional(),
  _max: FtpQuotatAlliesHistoryMaxAggregateInputObjectSchema.optional(),
  _avg: FtpQuotatAlliesHistoryAvgAggregateInputObjectSchema.optional(),
  _sum: FtpQuotatAlliesHistorySumAggregateInputObjectSchema.optional(),
});
