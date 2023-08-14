import { z } from 'zod';
import { CuponsUsedWhereInputObjectSchema } from './objects/CuponsUsedWhereInput.schema';
import { CuponsUsedOrderByWithAggregationInputObjectSchema } from './objects/CuponsUsedOrderByWithAggregationInput.schema';
import { CuponsUsedScalarWhereWithAggregatesInputObjectSchema } from './objects/CuponsUsedScalarWhereWithAggregatesInput.schema';
import { CuponsUsedScalarFieldEnumSchema } from './enums/CuponsUsedScalarFieldEnum.schema';

export const CuponsUsedGroupBySchema = z.object({
  where: CuponsUsedWhereInputObjectSchema.optional(),
  orderBy: z
    .union([
      CuponsUsedOrderByWithAggregationInputObjectSchema,
      CuponsUsedOrderByWithAggregationInputObjectSchema.array(),
    ])
    .optional(),
  having: CuponsUsedScalarWhereWithAggregatesInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  by: z.array(CuponsUsedScalarFieldEnumSchema),
});
