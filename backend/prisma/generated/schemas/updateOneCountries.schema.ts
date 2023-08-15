import { z } from 'zod';
import { CountriesUpdateInputObjectSchema } from './objects/CountriesUpdateInput.schema';
import { CountriesUncheckedUpdateInputObjectSchema } from './objects/CountriesUncheckedUpdateInput.schema';
import { CountriesWhereUniqueInputObjectSchema } from './objects/CountriesWhereUniqueInput.schema';

export const CountriesUpdateOneSchema = z.object({
  data: z.union([
    CountriesUpdateInputObjectSchema,
    CountriesUncheckedUpdateInputObjectSchema,
  ]),
  where: CountriesWhereUniqueInputObjectSchema,
});
