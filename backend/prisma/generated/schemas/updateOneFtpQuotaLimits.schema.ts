import { z } from 'zod';
import { FtpQuotaLimitsUpdateInputObjectSchema } from './objects/FtpQuotaLimitsUpdateInput.schema';
import { FtpQuotaLimitsUncheckedUpdateInputObjectSchema } from './objects/FtpQuotaLimitsUncheckedUpdateInput.schema';
import { FtpQuotaLimitsWhereUniqueInputObjectSchema } from './objects/FtpQuotaLimitsWhereUniqueInput.schema';

export const FtpQuotaLimitsUpdateOneSchema = z.object({
  data: z.union([
    FtpQuotaLimitsUpdateInputObjectSchema,
    FtpQuotaLimitsUncheckedUpdateInputObjectSchema,
  ]),
  where: FtpQuotaLimitsWhereUniqueInputObjectSchema,
});
