import { z } from 'zod';
import { FtpQuotaLimitsUpdateManyMutationInputObjectSchema } from './objects/FtpQuotaLimitsUpdateManyMutationInput.schema';
import { FtpQuotaLimitsWhereInputObjectSchema } from './objects/FtpQuotaLimitsWhereInput.schema';

export const FtpQuotaLimitsUpdateManySchema = z.object({
  data: FtpQuotaLimitsUpdateManyMutationInputObjectSchema,
  where: FtpQuotaLimitsWhereInputObjectSchema.optional(),
});
