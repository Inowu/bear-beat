import { z } from 'zod';
import { FtpQuotaLimitsWhereUniqueInputObjectSchema } from './objects/FtpQuotaLimitsWhereUniqueInput.schema';

export const FtpQuotaLimitsDeleteOneSchema = z.object({
  where: FtpQuotaLimitsWhereUniqueInputObjectSchema,
});
