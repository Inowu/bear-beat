import { z } from 'zod';

export const UserFilesScalarFieldEnumSchema = z.enum([
  'id',
  'product_id',
  'downloads_left',
  'order_id',
  'user_id',
  'since',
]);
