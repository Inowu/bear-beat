import { z } from 'zod';

/* eslint-disable-next-line */
export const ftpquotatallies_quota_typeSchema = z.enum([
  'user',
  'group',
  'class',
  'all',
]);
