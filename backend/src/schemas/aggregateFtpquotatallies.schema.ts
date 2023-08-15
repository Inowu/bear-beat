import { z } from 'zod';
import { FtpquotatalliesOrderByWithRelationInputObjectSchema } from './objects/FtpquotatalliesOrderByWithRelationInput.schema';
import { FtpquotatalliesWhereInputObjectSchema } from './objects/FtpquotatalliesWhereInput.schema';
import { FtpquotatalliesWhereUniqueInputObjectSchema } from './objects/FtpquotatalliesWhereUniqueInput.schema';
import { FtpquotatalliesCountAggregateInputObjectSchema } from './objects/FtpquotatalliesCountAggregateInput.schema';
import { FtpquotatalliesMinAggregateInputObjectSchema } from './objects/FtpquotatalliesMinAggregateInput.schema';
import { FtpquotatalliesMaxAggregateInputObjectSchema } from './objects/FtpquotatalliesMaxAggregateInput.schema';
import { FtpquotatalliesAvgAggregateInputObjectSchema } from './objects/FtpquotatalliesAvgAggregateInput.schema';
import { FtpquotatalliesSumAggregateInputObjectSchema } from './objects/FtpquotatalliesSumAggregateInput.schema';

export const FtpquotatalliesAggregateSchema = z.object({
  orderBy: z
    .union([
      FtpquotatalliesOrderByWithRelationInputObjectSchema,
      FtpquotatalliesOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: FtpquotatalliesWhereInputObjectSchema.optional(),
  cursor: FtpquotatalliesWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  _count: z
    .union([z.literal(true), FtpquotatalliesCountAggregateInputObjectSchema])
    .optional(),
  _min: FtpquotatalliesMinAggregateInputObjectSchema.optional(),
  _max: FtpquotatalliesMaxAggregateInputObjectSchema.optional(),
  _avg: FtpquotatalliesAvgAggregateInputObjectSchema.optional(),
  _sum: FtpquotatalliesSumAggregateInputObjectSchema.optional(),
});
