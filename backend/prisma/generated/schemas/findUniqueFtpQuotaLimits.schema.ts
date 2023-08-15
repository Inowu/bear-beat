import { z } from 'zod';
import { FtpQuotaLimitsWhereUniqueInputObjectSchema } from './objects/FtpQuotaLimitsWhereUniqueInput.schema';

export const FtpQuotaLimitsFindUniqueSchema = z.object({
  where: FtpQuotaLimitsWhereUniqueInputObjectSchema,
});
