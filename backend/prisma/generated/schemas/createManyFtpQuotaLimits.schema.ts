import { z } from 'zod';
import { FtpQuotaLimitsCreateManyInputObjectSchema } from './objects/FtpQuotaLimitsCreateManyInput.schema';

export const FtpQuotaLimitsCreateManySchema = z.object({
  data: z.union([
    FtpQuotaLimitsCreateManyInputObjectSchema,
    z.array(FtpQuotaLimitsCreateManyInputObjectSchema),
  ]),
  skipDuplicates: z.boolean().optional(),
});
