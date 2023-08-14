import { z } from 'zod';
import { FtpQuotatAlliesHistorySelectObjectSchema } from './objects/FtpQuotatAlliesHistorySelect.schema';
import { FtpQuotatAlliesHistoryUpdateInputObjectSchema } from './objects/FtpQuotatAlliesHistoryUpdateInput.schema';
import { FtpQuotatAlliesHistoryUncheckedUpdateInputObjectSchema } from './objects/FtpQuotatAlliesHistoryUncheckedUpdateInput.schema';
import { FtpQuotatAlliesHistoryWhereUniqueInputObjectSchema } from './objects/FtpQuotatAlliesHistoryWhereUniqueInput.schema';

export const FtpQuotatAlliesHistoryUpdateOneSchema = z.object({
  select: FtpQuotatAlliesHistorySelectObjectSchema.optional(),
  data: z.union([
    FtpQuotatAlliesHistoryUpdateInputObjectSchema,
    FtpQuotatAlliesHistoryUncheckedUpdateInputObjectSchema,
  ]),
  where: FtpQuotatAlliesHistoryWhereUniqueInputObjectSchema,
});
