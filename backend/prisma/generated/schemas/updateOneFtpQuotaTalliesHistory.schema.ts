import { z } from 'zod';
import { FtpQuotaTalliesHistoryUpdateInputObjectSchema } from './objects/FtpQuotaTalliesHistoryUpdateInput.schema';
import { FtpQuotaTalliesHistoryUncheckedUpdateInputObjectSchema } from './objects/FtpQuotaTalliesHistoryUncheckedUpdateInput.schema';
import { FtpQuotaTalliesHistoryWhereUniqueInputObjectSchema } from './objects/FtpQuotaTalliesHistoryWhereUniqueInput.schema';

export const FtpQuotaTalliesHistoryUpdateOneSchema = z.object({
  data: z.union([
    FtpQuotaTalliesHistoryUpdateInputObjectSchema,
    FtpQuotaTalliesHistoryUncheckedUpdateInputObjectSchema,
  ]),
  where: FtpQuotaTalliesHistoryWhereUniqueInputObjectSchema,
});
