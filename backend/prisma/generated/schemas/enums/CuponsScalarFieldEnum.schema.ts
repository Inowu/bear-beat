import { z } from 'zod';

export const CuponsScalarFieldEnumSchema = z.enum([
  'id',
  'code',
  'discount',
  'type',
  'cupon_condition',
  'parameter',
  'description',
  'active',
]);
