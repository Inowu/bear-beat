import { z } from 'zod';
import { CountriesWhereUniqueInputObjectSchema } from './objects/CountriesWhereUniqueInput.schema';

export const CountriesDeleteOneSchema = z.object({
  where: CountriesWhereUniqueInputObjectSchema,
});
