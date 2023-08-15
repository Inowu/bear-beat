import { z } from 'zod';
import { CountriesWhereUniqueInputObjectSchema } from './objects/CountriesWhereUniqueInput.schema';
import { CountriesCreateInputObjectSchema } from './objects/CountriesCreateInput.schema';
import { CountriesUncheckedCreateInputObjectSchema } from './objects/CountriesUncheckedCreateInput.schema';
import { CountriesUpdateInputObjectSchema } from './objects/CountriesUpdateInput.schema';
import { CountriesUncheckedUpdateInputObjectSchema } from './objects/CountriesUncheckedUpdateInput.schema';

export const CountriesUpsertSchema = z.object({
  where: CountriesWhereUniqueInputObjectSchema,
  create: z.union([
    CountriesCreateInputObjectSchema,
    CountriesUncheckedCreateInputObjectSchema,
  ]),
  update: z.union([
    CountriesUpdateInputObjectSchema,
    CountriesUncheckedUpdateInputObjectSchema,
  ]),
});
