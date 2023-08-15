import { z } from 'zod';

export const CountriesScalarFieldEnumSchema = z.enum(['id', 'name', 'code']);
