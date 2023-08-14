import { z } from 'zod';
import { FtpQuotaLimitsSelectObjectSchema } from './objects/FtpQuotaLimitsSelect.schema';
import { FtpQuotaLimitsUpdateInputObjectSchema } from './objects/FtpQuotaLimitsUpdateInput.schema';
import { FtpQuotaLimitsUncheckedUpdateInputObjectSchema } from './objects/FtpQuotaLimitsUncheckedUpdateInput.schema';
import { FtpQuotaLimitsWhereUniqueInputObjectSchema } from './objects/FtpQuotaLimitsWhereUniqueInput.schema';

export const FtpQuotaLimitsUpdateOneSchema = z.object({
  select: FtpQuotaLimitsSelectObjectSchema.optional(),
  data: z.union([
    FtpQuotaLimitsUpdateInputObjectSchema,
    FtpQuotaLimitsUncheckedUpdateInputObjectSchema,
  ]),
  where: FtpQuotaLimitsWhereUniqueInputObjectSchema,
});
