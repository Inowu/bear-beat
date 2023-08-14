import { z } from 'zod';
import { CountriesWhereInputObjectSchema } from './objects/CountriesWhereInput.schema';
import { CountriesOrderByWithAggregationInputObjectSchema } from './objects/CountriesOrderByWithAggregationInput.schema';
import { CountriesScalarWhereWithAggregatesInputObjectSchema } from './objects/CountriesScalarWhereWithAggregatesInput.schema';
import { CountriesScalarFieldEnumSchema } from './enums/CountriesScalarFieldEnum.schema';

export const CountriesGroupBySchema = z.object({
  where: CountriesWhereInputObjectSchema.optional(),
  orderBy: z
    .union([
      CountriesOrderByWithAggregationInputObjectSchema,
      CountriesOrderByWithAggregationInputObjectSchema.array(),
    ])
    .optional(),
  having: CountriesScalarWhereWithAggregatesInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  by: z.array(CountriesScalarFieldEnumSchema),
});
