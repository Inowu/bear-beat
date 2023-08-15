import { z } from 'zod';
import { FtpQuotaTalliesHistoryWhereUniqueInputObjectSchema } from './objects/FtpQuotaTalliesHistoryWhereUniqueInput.schema';
import { FtpQuotaTalliesHistoryCreateInputObjectSchema } from './objects/FtpQuotaTalliesHistoryCreateInput.schema';
import { FtpQuotaTalliesHistoryUncheckedCreateInputObjectSchema } from './objects/FtpQuotaTalliesHistoryUncheckedCreateInput.schema';
import { FtpQuotaTalliesHistoryUpdateInputObjectSchema } from './objects/FtpQuotaTalliesHistoryUpdateInput.schema';
import { FtpQuotaTalliesHistoryUncheckedUpdateInputObjectSchema } from './objects/FtpQuotaTalliesHistoryUncheckedUpdateInput.schema';

export const FtpQuotaTalliesHistoryUpsertSchema = z.object({
  where: FtpQuotaTalliesHistoryWhereUniqueInputObjectSchema,
  create: z.union([
    FtpQuotaTalliesHistoryCreateInputObjectSchema,
    FtpQuotaTalliesHistoryUncheckedCreateInputObjectSchema,
  ]),
  update: z.union([
    FtpQuotaTalliesHistoryUpdateInputObjectSchema,
    FtpQuotaTalliesHistoryUncheckedUpdateInputObjectSchema,
  ]),
});
