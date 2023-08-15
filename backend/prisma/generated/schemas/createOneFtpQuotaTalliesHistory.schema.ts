import { z } from 'zod';
import { FtpQuotaTalliesHistoryCreateInputObjectSchema } from './objects/FtpQuotaTalliesHistoryCreateInput.schema';
import { FtpQuotaTalliesHistoryUncheckedCreateInputObjectSchema } from './objects/FtpQuotaTalliesHistoryUncheckedCreateInput.schema';

export const FtpQuotaTalliesHistoryCreateOneSchema = z.object({
  data: z.union([
    FtpQuotaTalliesHistoryCreateInputObjectSchema,
    FtpQuotaTalliesHistoryUncheckedCreateInputObjectSchema,
  ]),
});
