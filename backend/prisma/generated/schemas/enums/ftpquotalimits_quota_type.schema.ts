import { z } from 'zod';

export const ftpquotalimits_quota_typeSchema = z.enum([
  'user',
  'group',
  'class',
  'all',
]);
