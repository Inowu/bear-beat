import { z } from 'zod';
import { CountriesCreateInputObjectSchema } from './objects/CountriesCreateInput.schema';
import { CountriesUncheckedCreateInputObjectSchema } from './objects/CountriesUncheckedCreateInput.schema';

export const CountriesCreateOneSchema = z.object({
  data: z.union([
    CountriesCreateInputObjectSchema,
    CountriesUncheckedCreateInputObjectSchema,
  ]),
});
