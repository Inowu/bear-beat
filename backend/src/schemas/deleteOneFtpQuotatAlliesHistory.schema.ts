import { z } from 'zod';
import { FtpQuotatAlliesHistorySelectObjectSchema } from './objects/FtpQuotatAlliesHistorySelect.schema';
import { FtpQuotatAlliesHistoryWhereUniqueInputObjectSchema } from './objects/FtpQuotatAlliesHistoryWhereUniqueInput.schema';

export const FtpQuotatAlliesHistoryDeleteOneSchema = z.object({
  select: FtpQuotatAlliesHistorySelectObjectSchema.optional(),
  where: FtpQuotatAlliesHistoryWhereUniqueInputObjectSchema,
});
