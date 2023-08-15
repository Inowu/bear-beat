import { z } from 'zod';
import { FtpquotatalliesWhereInputObjectSchema } from './objects/FtpquotatalliesWhereInput.schema';
import { FtpquotatalliesOrderByWithAggregationInputObjectSchema } from './objects/FtpquotatalliesOrderByWithAggregationInput.schema';
import { FtpquotatalliesScalarWhereWithAggregatesInputObjectSchema } from './objects/FtpquotatalliesScalarWhereWithAggregatesInput.schema';
import { FtpquotatalliesScalarFieldEnumSchema } from './enums/FtpquotatalliesScalarFieldEnum.schema';

export const FtpquotatalliesGroupBySchema = z.object({
  where: FtpquotatalliesWhereInputObjectSchema.optional(),
  orderBy: z
    .union([
      FtpquotatalliesOrderByWithAggregationInputObjectSchema,
      FtpquotatalliesOrderByWithAggregationInputObjectSchema.array(),
    ])
    .optional(),
  having: FtpquotatalliesScalarWhereWithAggregatesInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  by: z.array(FtpquotatalliesScalarFieldEnumSchema),
});
