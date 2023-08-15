import { z } from 'zod';
import { FtpQuotaTalliesHistoryOrderByWithRelationInputObjectSchema } from './objects/FtpQuotaTalliesHistoryOrderByWithRelationInput.schema';
import { FtpQuotaTalliesHistoryWhereInputObjectSchema } from './objects/FtpQuotaTalliesHistoryWhereInput.schema';
import { FtpQuotaTalliesHistoryWhereUniqueInputObjectSchema } from './objects/FtpQuotaTalliesHistoryWhereUniqueInput.schema';
import { FtpQuotaTalliesHistoryScalarFieldEnumSchema } from './enums/FtpQuotaTalliesHistoryScalarFieldEnum.schema';

export const FtpQuotaTalliesHistoryFindFirstSchema = z.object({
  orderBy: z
    .union([
      FtpQuotaTalliesHistoryOrderByWithRelationInputObjectSchema,
      FtpQuotaTalliesHistoryOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: FtpQuotaTalliesHistoryWhereInputObjectSchema.optional(),
  cursor: FtpQuotaTalliesHistoryWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.array(FtpQuotaTalliesHistoryScalarFieldEnumSchema).optional(),
});
