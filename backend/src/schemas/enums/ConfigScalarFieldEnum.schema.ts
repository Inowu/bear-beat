import { z } from 'zod';

export const ConfigScalarFieldEnumSchema = z.enum(['id', 'name', 'value']);
