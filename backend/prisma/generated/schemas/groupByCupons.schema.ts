import { z } from 'zod';
import { CuponsWhereInputObjectSchema } from './objects/CuponsWhereInput.schema';
import { CuponsOrderByWithAggregationInputObjectSchema } from './objects/CuponsOrderByWithAggregationInput.schema';
import { CuponsScalarWhereWithAggregatesInputObjectSchema } from './objects/CuponsScalarWhereWithAggregatesInput.schema';
import { CuponsScalarFieldEnumSchema } from './enums/CuponsScalarFieldEnum.schema';

export const CuponsGroupBySchema = z.object({
  where: CuponsWhereInputObjectSchema.optional(),
  orderBy: z
    .union([
      CuponsOrderByWithAggregationInputObjectSchema,
      CuponsOrderByWithAggregationInputObjectSchema.array(),
    ])
    .optional(),
  having: CuponsScalarWhereWithAggregatesInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  by: z.array(CuponsScalarFieldEnumSchema),
});
