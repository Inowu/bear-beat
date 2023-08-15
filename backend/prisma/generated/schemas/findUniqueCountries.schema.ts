import { z } from 'zod';
import { CountriesWhereUniqueInputObjectSchema } from './objects/CountriesWhereUniqueInput.schema';

export const CountriesFindUniqueSchema = z.object({
  where: CountriesWhereUniqueInputObjectSchema,
});
