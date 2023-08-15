import { z } from 'zod';
import { FtpQuotaTalliesHistoryWhereUniqueInputObjectSchema } from './objects/FtpQuotaTalliesHistoryWhereUniqueInput.schema';

export const FtpQuotaTalliesHistoryDeleteOneSchema = z.object({
  where: FtpQuotaTalliesHistoryWhereUniqueInputObjectSchema,
});
