import { z } from 'zod';
import { CountriesOrderByWithRelationInputObjectSchema } from './objects/CountriesOrderByWithRelationInput.schema';
import { CountriesWhereInputObjectSchema } from './objects/CountriesWhereInput.schema';
import { CountriesWhereUniqueInputObjectSchema } from './objects/CountriesWhereUniqueInput.schema';
import { CountriesMinAggregateInputObjectSchema } from './objects/CountriesMinAggregateInput.schema';
import { CountriesMaxAggregateInputObjectSchema } from './objects/CountriesMaxAggregateInput.schema';
import { CountriesAvgAggregateInputObjectSchema } from './objects/CountriesAvgAggregateInput.schema';
import { CountriesSumAggregateInputObjectSchema } from './objects/CountriesSumAggregateInput.schema';

export const CountriesAggregateSchema = z.object({
  orderBy: z
    .union([
      CountriesOrderByWithRelationInputObjectSchema,
      CountriesOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: CountriesWhereInputObjectSchema.optional(),
  cursor: CountriesWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  _min: CountriesMinAggregateInputObjectSchema.optional(),
  _max: CountriesMaxAggregateInputObjectSchema.optional(),
  _avg: CountriesAvgAggregateInputObjectSchema.optional(),
  _sum: CountriesSumAggregateInputObjectSchema.optional(),
});
