import { z } from 'zod';
import { CountriesSelectObjectSchema } from './objects/CountriesSelect.schema';
import { CountriesWhereUniqueInputObjectSchema } from './objects/CountriesWhereUniqueInput.schema';

export const CountriesDeleteOneSchema = z.object({
  select: CountriesSelectObjectSchema.optional(),
  where: CountriesWhereUniqueInputObjectSchema,
});
