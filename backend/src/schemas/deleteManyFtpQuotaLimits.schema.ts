import { z } from 'zod';
import { FtpQuotaLimitsWhereInputObjectSchema } from './objects/FtpQuotaLimitsWhereInput.schema';

export const FtpQuotaLimitsDeleteManySchema = z.object({
  where: FtpQuotaLimitsWhereInputObjectSchema.optional(),
});
