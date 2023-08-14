import { z } from 'zod';
import { CountriesSelectObjectSchema } from './objects/CountriesSelect.schema';
import { CountriesUpdateInputObjectSchema } from './objects/CountriesUpdateInput.schema';
import { CountriesUncheckedUpdateInputObjectSchema } from './objects/CountriesUncheckedUpdateInput.schema';
import { CountriesWhereUniqueInputObjectSchema } from './objects/CountriesWhereUniqueInput.schema';

export const CountriesUpdateOneSchema = z.object({
  select: CountriesSelectObjectSchema.optional(),
  data: z.union([
    CountriesUpdateInputObjectSchema,
    CountriesUncheckedUpdateInputObjectSchema,
  ]),
  where: CountriesWhereUniqueInputObjectSchema,
});
