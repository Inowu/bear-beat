import { z } from 'zod';

export const CuponsUsedScalarFieldEnumSchema = z.enum([
  'id',
  'user_id',
  'cupon_id',
  'date_cupon',
]);
