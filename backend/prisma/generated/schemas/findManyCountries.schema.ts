import { z } from 'zod';
import { CountriesOrderByWithRelationInputObjectSchema } from './objects/CountriesOrderByWithRelationInput.schema';
import { CountriesWhereInputObjectSchema } from './objects/CountriesWhereInput.schema';
import { CountriesWhereUniqueInputObjectSchema } from './objects/CountriesWhereUniqueInput.schema';
import { CountriesScalarFieldEnumSchema } from './enums/CountriesScalarFieldEnum.schema';

export const CountriesFindManySchema = z.object({
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
  distinct: z.array(CountriesScalarFieldEnumSchema).optional(),
});
