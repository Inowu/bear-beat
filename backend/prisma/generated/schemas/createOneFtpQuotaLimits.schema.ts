import { z } from 'zod';
import { FtpQuotaLimitsCreateInputObjectSchema } from './objects/FtpQuotaLimitsCreateInput.schema';
import { FtpQuotaLimitsUncheckedCreateInputObjectSchema } from './objects/FtpQuotaLimitsUncheckedCreateInput.schema';

export const FtpQuotaLimitsCreateOneSchema = z.object({
  data: z.union([
    FtpQuotaLimitsCreateInputObjectSchema,
    FtpQuotaLimitsUncheckedCreateInputObjectSchema,
  ]),
});
