import { z } from 'zod';
import { CountriesUpdateManyMutationInputObjectSchema } from './objects/CountriesUpdateManyMutationInput.schema';
import { CountriesWhereInputObjectSchema } from './objects/CountriesWhereInput.schema';

export const CountriesUpdateManySchema = z.object({
  data: CountriesUpdateManyMutationInputObjectSchema,
  where: CountriesWhereInputObjectSchema.optional(),
});
