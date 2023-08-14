import { z } from 'zod';

export const DescargasUserScalarFieldEnumSchema = z.enum([
  'id',
  'user_id',
  'order_id',
  'available',
  'ilimitado',
  'date_end',
]);
