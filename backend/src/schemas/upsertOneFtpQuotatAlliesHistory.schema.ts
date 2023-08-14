import { z } from 'zod';
import { FtpQuotatAlliesHistorySelectObjectSchema } from './objects/FtpQuotatAlliesHistorySelect.schema';
import { FtpQuotatAlliesHistoryWhereUniqueInputObjectSchema } from './objects/FtpQuotatAlliesHistoryWhereUniqueInput.schema';
import { FtpQuotatAlliesHistoryCreateInputObjectSchema } from './objects/FtpQuotatAlliesHistoryCreateInput.schema';
import { FtpQuotatAlliesHistoryUncheckedCreateInputObjectSchema } from './objects/FtpQuotatAlliesHistoryUncheckedCreateInput.schema';
import { FtpQuotatAlliesHistoryUpdateInputObjectSchema } from './objects/FtpQuotatAlliesHistoryUpdateInput.schema';
import { FtpQuotatAlliesHistoryUncheckedUpdateInputObjectSchema } from './objects/FtpQuotatAlliesHistoryUncheckedUpdateInput.schema';

export const FtpQuotatAlliesHistoryUpsertSchema = z.object({
  select: FtpQuotatAlliesHistorySelectObjectSchema.optional(),
  where: FtpQuotatAlliesHistoryWhereUniqueInputObjectSchema,
  create: z.union([
    FtpQuotatAlliesHistoryCreateInputObjectSchema,
    FtpQuotatAlliesHistoryUncheckedCreateInputObjectSchema,
  ]),
  update: z.union([
    FtpQuotatAlliesHistoryUpdateInputObjectSchema,
    FtpQuotatAlliesHistoryUncheckedUpdateInputObjectSchema,
  ]),
});
