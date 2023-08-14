import { z } from 'zod';

export const ftpquotatallies_history_quota_typeSchema = z.enum([
  'user',
  'group',
  'class',
  'all',
]);
