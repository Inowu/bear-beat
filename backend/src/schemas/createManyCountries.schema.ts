import { z } from 'zod';
import { CountriesCreateManyInputObjectSchema } from './objects/CountriesCreateManyInput.schema';

export const CountriesCreateManySchema = z.object({
  data: z.union([
    CountriesCreateManyInputObjectSchema,
    z.array(CountriesCreateManyInputObjectSchema),
  ]),
  skipDuplicates: z.boolean().optional(),
});
