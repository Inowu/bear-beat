import { z } from 'zod';
import { CountriesSelectObjectSchema } from './objects/CountriesSelect.schema';
import { CountriesCreateInputObjectSchema } from './objects/CountriesCreateInput.schema';
import { CountriesUncheckedCreateInputObjectSchema } from './objects/CountriesUncheckedCreateInput.schema';

export const CountriesCreateOneSchema = z.object({
  select: CountriesSelectObjectSchema.optional(),
  data: z.union([
    CountriesCreateInputObjectSchema,
    CountriesUncheckedCreateInputObjectSchema,
  ]),
});
