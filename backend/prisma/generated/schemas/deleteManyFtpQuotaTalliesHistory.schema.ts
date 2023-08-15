import { z } from 'zod';
import { FtpQuotaTalliesHistoryWhereInputObjectSchema } from './objects/FtpQuotaTalliesHistoryWhereInput.schema';

export const FtpQuotaTalliesHistoryDeleteManySchema = z.object({
  where: FtpQuotaTalliesHistoryWhereInputObjectSchema.optional(),
});
