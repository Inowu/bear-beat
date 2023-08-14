import { z } from 'zod';
import { FtpQuotaLimitsSelectObjectSchema } from './objects/FtpQuotaLimitsSelect.schema';
import { FtpQuotaLimitsCreateInputObjectSchema } from './objects/FtpQuotaLimitsCreateInput.schema';
import { FtpQuotaLimitsUncheckedCreateInputObjectSchema } from './objects/FtpQuotaLimitsUncheckedCreateInput.schema';

export const FtpQuotaLimitsCreateOneSchema = z.object({
  select: FtpQuotaLimitsSelectObjectSchema.optional(),
  data: z.union([
    FtpQuotaLimitsCreateInputObjectSchema,
    FtpQuotaLimitsUncheckedCreateInputObjectSchema,
  ]),
});
