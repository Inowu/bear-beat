import { z } from 'zod';

export const FtpQuotaLimitsScalarFieldEnumSchema = z.enum([
  'id',
  'name',
  'quota_type',
  'per_session',
  'limit_type',
  'bytes_in_avail',
  'bytes_out_avail',
  'bytes_xfer_avail',
  'files_in_avail',
  'files_out_avail',
  'files_xfer_avail',
]);
