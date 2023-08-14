import { z } from 'zod';
import { FtpUserOrderByWithRelationInputObjectSchema } from './objects/FtpUserOrderByWithRelationInput.schema';
import { FtpUserWhereInputObjectSchema } from './objects/FtpUserWhereInput.schema';
import { FtpUserWhereUniqueInputObjectSchema } from './objects/FtpUserWhereUniqueInput.schema';
import { FtpUserCountAggregateInputObjectSchema } from './objects/FtpUserCountAggregateInput.schema';
import { FtpUserMinAggregateInputObjectSchema } from './objects/FtpUserMinAggregateInput.schema';
import { FtpUserMaxAggregateInputObjectSchema } from './objects/FtpUserMaxAggregateInput.schema';
import { FtpUserAvgAggregateInputObjectSchema } from './objects/FtpUserAvgAggregateInput.schema';
import { FtpUserSumAggregateInputObjectSchema } from './objects/FtpUserSumAggregateInput.schema';

export const FtpUserAggregateSchema = z.object({
  orderBy: z
    .union([
      FtpUserOrderByWithRelationInputObjectSchema,
      FtpUserOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: FtpUserWhereInputObjectSchema.optional(),
  cursor: FtpUserWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  _count: z
    .union([z.literal(true), FtpUserCountAggregateInputObjectSchema])
    .optional(),
  _min: FtpUserMinAggregateInputObjectSchema.optional(),
  _max: FtpUserMaxAggregateInputObjectSchema.optional(),
  _avg: FtpUserAvgAggregateInputObjectSchema.optional(),
  _sum: FtpUserSumAggregateInputObjectSchema.optional(),
});
