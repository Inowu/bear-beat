import { z } from 'zod';

export const FtpUserScalarFieldEnumSchema = z.enum([
  'id',
  'userid',
  'passwd',
  'uid',
  'gid',
  'homedir',
  'shell',
  'count',
  'accessed',
  'modified',
  'user_id',
  'order_id',
  'expiration',
]);
