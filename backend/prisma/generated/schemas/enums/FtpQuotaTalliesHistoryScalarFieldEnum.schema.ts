import { z } from 'zod';

export const FtpQuotaTalliesHistoryScalarFieldEnumSchema = z.enum([
  'id',
  'name',
  'quota_type',
  'bytes_in_used',
  'bytes_out_used',
  'bytes_xfer_used',
  'files_in_used',
  'files_out_used',
  'files_xfer_used',
]);
