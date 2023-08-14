import { z } from 'zod';
import { FtpQuotatAlliesHistoryUpdateManyMutationInputObjectSchema } from './objects/FtpQuotatAlliesHistoryUpdateManyMutationInput.schema';
import { FtpQuotatAlliesHistoryWhereInputObjectSchema } from './objects/FtpQuotatAlliesHistoryWhereInput.schema';

export const FtpQuotatAlliesHistoryUpdateManySchema = z.object({
  data: FtpQuotatAlliesHistoryUpdateManyMutationInputObjectSchema,
  where: FtpQuotatAlliesHistoryWhereInputObjectSchema.optional(),
});
