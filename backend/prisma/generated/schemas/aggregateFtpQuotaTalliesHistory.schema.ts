import { z } from 'zod';
import { FtpQuotaTalliesHistoryOrderByWithRelationInputObjectSchema } from './objects/FtpQuotaTalliesHistoryOrderByWithRelationInput.schema';
import { FtpQuotaTalliesHistoryWhereInputObjectSchema } from './objects/FtpQuotaTalliesHistoryWhereInput.schema';
import { FtpQuotaTalliesHistoryWhereUniqueInputObjectSchema } from './objects/FtpQuotaTalliesHistoryWhereUniqueInput.schema';
import { FtpQuotaTalliesHistoryCountAggregateInputObjectSchema } from './objects/FtpQuotaTalliesHistoryCountAggregateInput.schema';
import { FtpQuotaTalliesHistoryMinAggregateInputObjectSchema } from './objects/FtpQuotaTalliesHistoryMinAggregateInput.schema';
import { FtpQuotaTalliesHistoryMaxAggregateInputObjectSchema } from './objects/FtpQuotaTalliesHistoryMaxAggregateInput.schema';
import { FtpQuotaTalliesHistoryAvgAggregateInputObjectSchema } from './objects/FtpQuotaTalliesHistoryAvgAggregateInput.schema';
import { FtpQuotaTalliesHistorySumAggregateInputObjectSchema } from './objects/FtpQuotaTalliesHistorySumAggregateInput.schema';

export const FtpQuotaTalliesHistoryAggregateSchema = z.object({
  orderBy: z
    .union([
      FtpQuotaTalliesHistoryOrderByWithRelationInputObjectSchema,
      FtpQuotaTalliesHistoryOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: FtpQuotaTalliesHistoryWhereInputObjectSchema.optional(),
  cursor: FtpQuotaTalliesHistoryWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  _count: z
    .union([
      z.literal(true),
      FtpQuotaTalliesHistoryCountAggregateInputObjectSchema,
    ])
    .optional(),
  _min: FtpQuotaTalliesHistoryMinAggregateInputObjectSchema.optional(),
  _max: FtpQuotaTalliesHistoryMaxAggregateInputObjectSchema.optional(),
  _avg: FtpQuotaTalliesHistoryAvgAggregateInputObjectSchema.optional(),
  _sum: FtpQuotaTalliesHistorySumAggregateInputObjectSchema.optional(),
});
