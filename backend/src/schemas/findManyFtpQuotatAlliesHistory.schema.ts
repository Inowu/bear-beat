import { z } from 'zod';
import { FtpQuotatAlliesHistorySelectObjectSchema } from './objects/FtpQuotatAlliesHistorySelect.schema';
import { FtpQuotatAlliesHistoryOrderByWithRelationInputObjectSchema } from './objects/FtpQuotatAlliesHistoryOrderByWithRelationInput.schema';
import { FtpQuotatAlliesHistoryWhereInputObjectSchema } from './objects/FtpQuotatAlliesHistoryWhereInput.schema';
import { FtpQuotatAlliesHistoryWhereUniqueInputObjectSchema } from './objects/FtpQuotatAlliesHistoryWhereUniqueInput.schema';
import { FtpQuotatAlliesHistoryScalarFieldEnumSchema } from './enums/FtpQuotatAlliesHistoryScalarFieldEnum.schema';

export const FtpQuotatAlliesHistoryFindManySchema = z.object({
  select: z.lazy(() => FtpQuotatAlliesHistorySelectObjectSchema.optional()),
  orderBy: z
    .union([
      FtpQuotatAlliesHistoryOrderByWithRelationInputObjectSchema,
      FtpQuotatAlliesHistoryOrderByWithRelationInputObjectSchema.array(),
    ])
    .optional(),
  where: FtpQuotatAlliesHistoryWhereInputObjectSchema.optional(),
  cursor: FtpQuotatAlliesHistoryWhereUniqueInputObjectSchema.optional(),
  take: z.number().optional(),
  skip: z.number().optional(),
  distinct: z.array(FtpQuotatAlliesHistoryScalarFieldEnumSchema).optional(),
});
