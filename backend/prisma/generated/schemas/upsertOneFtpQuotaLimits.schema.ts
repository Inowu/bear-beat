import { z } from 'zod';
import { FtpQuotaLimitsWhereUniqueInputObjectSchema } from './objects/FtpQuotaLimitsWhereUniqueInput.schema';
import { FtpQuotaLimitsCreateInputObjectSchema } from './objects/FtpQuotaLimitsCreateInput.schema';
import { FtpQuotaLimitsUncheckedCreateInputObjectSchema } from './objects/FtpQuotaLimitsUncheckedCreateInput.schema';
import { FtpQuotaLimitsUpdateInputObjectSchema } from './objects/FtpQuotaLimitsUpdateInput.schema';
import { FtpQuotaLimitsUncheckedUpdateInputObjectSchema } from './objects/FtpQuotaLimitsUncheckedUpdateInput.schema';

export const FtpQuotaLimitsUpsertSchema = z.object({
  where: FtpQuotaLimitsWhereUniqueInputObjectSchema,
  create: z.union([
    FtpQuotaLimitsCreateInputObjectSchema,
    FtpQuotaLimitsUncheckedCreateInputObjectSchema,
  ]),
  update: z.union([
    FtpQuotaLimitsUpdateInputObjectSchema,
    FtpQuotaLimitsUncheckedUpdateInputObjectSchema,
  ]),
});
