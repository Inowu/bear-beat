import { z } from 'zod';
import { FtpQuotaLimitsOrderByWithRelationInputObjectSchema } from './objects/FtpQuotaLimitsOrderByWithRelationInput.schema';
import { FtpQuotaLimitsWhereInputObjectSchema } from './objects/FtpQuotaLimitsWhereInput.schema';
import { FtpQuotaLimitsWhereUniqueInputObjectSchema } from './objects/FtpQuotaLimitsWhereUniqueInput.schema';
import { FtpQuotaLimitsScalarFieldEnumSchema } from './enums/FtpQuotaLimitsScalarFieldEnum.schema';

export const FtpQuotaLimitsFindManySchema = z.object({
  orderBy: z
    .union([
      FtpQuotaLimitsOrderByWithRelationInputObjectSchema,
      FtpQuotaLimitsOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: FtpQuotaLimitsWhereInputObjectSchema.optional(),
  cursor: FtpQuotaLimitsWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.array(FtpQuotaLimitsScalarFieldEnumSchema).optional(),
});
