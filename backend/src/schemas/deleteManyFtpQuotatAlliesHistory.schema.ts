import { z } from 'zod';
import { FtpQuotatAlliesHistoryWhereInputObjectSchema } from './objects/FtpQuotatAlliesHistoryWhereInput.schema';

export const FtpQuotatAlliesHistoryDeleteManySchema = z.object({
  where: FtpQuotatAlliesHistoryWhereInputObjectSchema.optional(),
});
