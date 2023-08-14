import { z } from 'zod';
import { FtpQuotatAlliesHistorySelectObjectSchema } from './objects/FtpQuotatAlliesHistorySelect.schema';
import { FtpQuotatAlliesHistoryCreateInputObjectSchema } from './objects/FtpQuotatAlliesHistoryCreateInput.schema';
import { FtpQuotatAlliesHistoryUncheckedCreateInputObjectSchema } from './objects/FtpQuotatAlliesHistoryUncheckedCreateInput.schema';

export const FtpQuotatAlliesHistoryCreateOneSchema = z.object({
  select: FtpQuotatAlliesHistorySelectObjectSchema.optional(),
  data: z.union([
    FtpQuotatAlliesHistoryCreateInputObjectSchema,
    FtpQuotatAlliesHistoryUncheckedCreateInputObjectSchema,
  ]),
});
