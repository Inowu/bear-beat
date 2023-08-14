import { z } from 'zod';
import { CountriesWhereInputObjectSchema } from './objects/CountriesWhereInput.schema';

export const CountriesDeleteManySchema = z.object({
  where: CountriesWhereInputObjectSchema.optional(),
});
