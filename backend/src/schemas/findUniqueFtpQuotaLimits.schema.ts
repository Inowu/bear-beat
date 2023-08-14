import { z } from 'zod';
import { FtpQuotaLimitsSelectObjectSchema } from './objects/FtpQuotaLimitsSelect.schema';
import { FtpQuotaLimitsWhereUniqueInputObjectSchema } from './objects/FtpQuotaLimitsWhereUniqueInput.schema';

export const FtpQuotaLimitsFindUniqueSchema = z.object({
  select: FtpQuotaLimitsSelectObjectSchema.optional(),
  where: FtpQuotaLimitsWhereUniqueInputObjectSchema,
});
